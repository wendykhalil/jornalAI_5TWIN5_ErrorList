"""
AI service for Memory suggestions using Ollama.

Provides functions to:
- Suggest memory categories based on description
- Suggest memory tags based on title and description

Uses Ollama with JSON-formatted responses for reliability.
"""

import os
import json
import logging
import requests
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

# ==========================================
# OLLAMA CONFIGURATION
# ==========================================

OLLAMA_URL = os.getenv(
    "OLLAMA_URL",
    "http://127.0.0.1:11434/api/generate"
)

OLLAMA_MODEL = os.getenv(
    "OLLAMA_MODEL",
    "qwen2.5:3b"
)

# Request/response timeouts (seconds)
OLLAMA_TIMEOUT = (5, 30)  # (connection, read)

# Valid memory categories (must match Memory.CATEGORY_CHOICES)
VALID_CATEGORIES = [
    "Familie",
    "Amis",
    "Voyages",
    "Études",
    "Travail",
    "Événements personnels",
    "Célébrations",
    "Autres",
]


class OllamaError(Exception):
    """Base exception for Ollama-related errors."""
    pass


class OllamaUnavailableError(OllamaError):
    """Raised when Ollama server is unreachable."""
    pass


class OllamaTimeoutError(OllamaError):
    """Raised when Ollama request times out."""
    pass


class OllamaInvalidResponseError(OllamaError):
    """Raised when Ollama returns invalid or unparseable response."""
    pass


def suggest_category(description: str) -> Dict[str, any]:
    """
    Suggest a memory category based on description text.
    
    Args:
        description: Memory description text (required, non-empty)
    
    Returns:
        Dict with:
        - suggested_category: str (one of VALID_CATEGORIES)
        - confidence: float (0.0 to 1.0)
        - reasoning: str (why this category was chosen)
    
    Raises:
        OllamaTimeoutError: If request times out
        OllamaUnavailableError: If server unreachable
        OllamaInvalidResponseError: If response is invalid JSON or missing fields
        ValueError: If description is empty
    """
    if not description or not description.strip():
        raise ValueError("Description cannot be empty")
    
    # Truncate very long descriptions
    description = description[:1000].strip()
    
    valid_categories_str = ", ".join(VALID_CATEGORIES)
    
    prompt = f"""You are an AI that categorizes personal memories.

TASK:
Analyze the following memory description and suggest the most appropriate category.

VALID CATEGORIES ONLY:
{valid_categories_str}

MEMORY DESCRIPTION:
{description}

RESPONSE FORMAT:
Return ONLY valid JSON with these exact fields:
{{
  "suggested_category": "one of the valid categories above",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation (one sentence)"
}}

RULES:
- suggested_category MUST be one of the valid categories above
- confidence MUST be a number between 0.0 and 1.0
- Do not invent categories
- Return only JSON, no other text
"""
    
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.3,
            "num_predict": 200
        }
    }
    
    try:
        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=OLLAMA_TIMEOUT
        )
        response.raise_for_status()
        
        result = response.json()
        ai_text = result.get("response", "").strip()
        
        # Parse JSON response
        try:
            suggestion = json.loads(ai_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Ollama response as JSON: {ai_text}")
            raise OllamaInvalidResponseError(
                f"Ollama returned invalid JSON: {str(e)}"
            )
        
        # Validate response structure
        required_fields = ["suggested_category", "confidence", "reasoning"]
        for field in required_fields:
            if field not in suggestion:
                raise OllamaInvalidResponseError(
                    f"Missing required field in Ollama response: {field}"
                )
        
        # Validate category is in allowed list
        category = suggestion.get("suggested_category", "").strip()
        if category not in VALID_CATEGORIES:
            logger.warning(
                f"Ollama suggested invalid category '{category}', "
                f"falling back to 'Autres'"
            )
            suggestion["suggested_category"] = "Autres"
            suggestion["confidence"] = 0.5
        
        # Validate confidence is float between 0 and 1
        try:
            confidence = float(suggestion.get("confidence", 0.5))
            confidence = max(0.0, min(1.0, confidence))  # Clamp to [0, 1]
            suggestion["confidence"] = confidence
        except (ValueError, TypeError):
            suggestion["confidence"] = 0.5
        
        return suggestion
    
    except requests.exceptions.Timeout:
        logger.error("Ollama request timed out")
        raise OllamaTimeoutError("AI service timeout. Try again.")
    
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Cannot connect to Ollama: {str(e)}")
        raise OllamaUnavailableError(
            "AI service unavailable. Check that Ollama is running."
        )
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Ollama request failed: {str(e)}")
        raise OllamaUnavailableError(
            "AI service error. Try again later."
        )


def suggest_tags(title: str, description: str) -> Dict[str, any]:
    """
    Suggest memory tags based on title and description.
    
    Args:
        title: Memory title (required, non-empty)
        description: Memory description (required, non-empty)
    
    Returns:
        Dict with:
        - suggested_tags: List[str] (3-5 tags)
        - confidence: float (0.0 to 1.0)
    
    Raises:
        OllamaTimeoutError: If request times out
        OllamaUnavailableError: If server unreachable
        OllamaInvalidResponseError: If response is invalid JSON or missing fields
        ValueError: If title or description is empty
    """
    if not title or not title.strip():
        raise ValueError("Title cannot be empty")
    
    if not description or not description.strip():
        raise ValueError("Description cannot be empty")
    
    # Truncate very long text
    title = title[:200].strip()
    description = description[:1000].strip()
    
    prompt = f"""You are an AI that generates relevant tags for personal memories.

TASK:
Analyze the memory title and description, then suggest 3-5 relevant tags.

TITLE:
{title}

DESCRIPTION:
{description}

RESPONSE FORMAT:
Return ONLY valid JSON with these exact fields:
{{
  "suggested_tags": ["tag1", "tag2", "tag3"],
  "confidence": 0.0 to 1.0
}}

RULES:
- suggested_tags MUST be a list of 3-5 short strings
- Each tag should be 1-3 words
- Tags should be descriptive and relevant
- Use lowercase
- No special characters or punctuation in tags
- confidence MUST be a number between 0.0 and 1.0
- Return only JSON, no other text
"""
    
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.4,
            "num_predict": 200
        }
    }
    
    try:
        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=OLLAMA_TIMEOUT
        )
        response.raise_for_status()
        
        result = response.json()
        ai_text = result.get("response", "").strip()
        
        # Parse JSON response
        try:
            suggestion = json.loads(ai_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Ollama response as JSON: {ai_text}")
            raise OllamaInvalidResponseError(
                f"Ollama returned invalid JSON: {str(e)}"
            )
        
        # Validate response structure
        required_fields = ["suggested_tags", "confidence"]
        for field in required_fields:
            if field not in suggestion:
                raise OllamaInvalidResponseError(
                    f"Missing required field in Ollama response: {field}"
                )
        
        # Validate tags is list of strings
        tags = suggestion.get("suggested_tags", [])
        if not isinstance(tags, list):
            raise OllamaInvalidResponseError(
                "suggested_tags must be a list"
            )
        
        # Filter to valid tags (strings, non-empty, reasonable length)
        validated_tags = []
        for tag in tags:
            if isinstance(tag, str):
                tag = tag.strip().lower()
                # Remove special characters
                tag = "".join(c for c in tag if c.isalnum() or c in (" ", "-", "_"))
                if tag and len(tag) <= 50:
                    validated_tags.append(tag)
        
        # Ensure we have at least 1 tag, at most 5
        validated_tags = validated_tags[:5]
        if not validated_tags:
            validated_tags = ["memory"]  # Fallback
        
        suggestion["suggested_tags"] = validated_tags
        
        # Validate confidence is float between 0 and 1
        try:
            confidence = float(suggestion.get("confidence", 0.5))
            confidence = max(0.0, min(1.0, confidence))  # Clamp to [0, 1]
            suggestion["confidence"] = confidence
        except (ValueError, TypeError):
            suggestion["confidence"] = 0.5
        
        return suggestion
    
    except requests.exceptions.Timeout:
        logger.error("Ollama request timed out")
        raise OllamaTimeoutError("AI service timeout. Try again.")
    
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Cannot connect to Ollama: {str(e)}")
        raise OllamaUnavailableError(
            "AI service unavailable. Check that Ollama is running."
        )
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Ollama request failed: {str(e)}")
        raise OllamaUnavailableError(
            "AI service error. Try again later."
        )


def generate_summary(
    title: str,
    description: str,
    category: Optional[str] = None,
    tags: Optional[List[str]] = None,
    location: Optional[str] = None
) -> Dict[str, any]:
    """
    Generate a concise AI summary for a memory using Ollama.
    
    Args:
        title: Memory title (required, non-empty)
        description: Memory description (required, non-empty)
        category: Optional memory category (e.g., "Voyages")
        tags: Optional list of memory tags
        location: Optional memory location
    
    Returns:
        Dict with:
        - summary: str (2-4 sentences in French)
        - model: str (model name used)
    
    Raises:
        OllamaTimeoutError: If request times out
        OllamaUnavailableError: If server unreachable
        OllamaInvalidResponseError: If response is invalid
        ValueError: If title or description is empty
    """
    if not title or not title.strip():
        raise ValueError("Title cannot be empty")
    
    if not description or not description.strip():
        raise ValueError("Description cannot be empty")
    
    # Truncate very long text
    title = title[:200].strip()
    description = description[:1500].strip()
    
    # Build context string from optional fields
    context_parts = []
    if location:
        context_parts.append(f"Location: {location.strip()[:100]}")
    if category:
        context_parts.append(f"Category: {category.strip()[:50]}")
    if tags and isinstance(tags, list):
        tag_list = ", ".join(str(t).strip() for t in tags[:5] if t)
        if tag_list:
            context_parts.append(f"Tags: {tag_list}")
    
    context_str = "\n".join(context_parts) if context_parts else ""
    context_section = f"\n\nCONTEXT:\n{context_str}" if context_str else ""
    
    prompt = f"""You are an AI assistant that creates concise, meaningful summaries of personal memories.

Your task is to read the memory content and write a brief summary in French.

REQUIREMENTS:
- Write in French (Français)
- Keep summary to 2-4 sentences maximum
- Preserve the original meaning and important details
- Do not invent events, locations, emotions or facts not in the original content
- Focus on the essence of the memory
- Be respectful and non-judgmental
- Return ONLY the summary text, no JSON, no formatting, no extra text

MEMORY TITLE:
{title}

MEMORY DESCRIPTION:
{description}{context_section}

Now write a concise French summary of this memory:
"""
    
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_predict": 300
        }
    }
    
    try:
        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=OLLAMA_TIMEOUT
        )
        response.raise_for_status()
        
        result = response.json()
        summary_text = result.get("response", "").strip()
        
        if not summary_text:
            raise OllamaInvalidResponseError("Ollama returned empty response")
        
        # Validate summary is reasonable length (not too short, not too long)
        if len(summary_text) < 20:
            raise OllamaInvalidResponseError("Generated summary is too short")
        
        if len(summary_text) > 1000:
            # Truncate if somehow too long
            summary_text = summary_text[:1000].strip()
        
        return {
            "summary": summary_text,
            "model": OLLAMA_MODEL
        }
    
    except requests.exceptions.Timeout:
        logger.error("Ollama request timed out for summary generation")
        raise OllamaTimeoutError("AI summary generation timed out. Try again.")
    
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Cannot connect to Ollama for summary: {str(e)}")
        raise OllamaUnavailableError(
            "AI service unavailable. Check that Ollama is running."
        )
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Ollama request failed for summary: {str(e)}")
        raise OllamaUnavailableError(
            "AI service error. Try again later."
        )


def generate_period_insights(
    memories_data: List[Dict[str, any]],
    start_date: str,
    end_date: str,
    period_type: str = "custom"
) -> Dict[str, any]:
    """
    Generate an AI-powered summary of memories within a date period.
    
    Args:
        memories_data: List of memory dicts with title, description, category, tags, location, eventDate
        start_date: ISO format date string (YYYY-MM-DD)
        end_date: ISO format date string (YYYY-MM-DD)
        period_type: "month", "year", or "custom"
    
    Returns:
        Dict with:
        - summary: str (2-8 sentence French summary of the period)
        - memory_count: int (number of memories analyzed)
        - period_type: str
        - start_date: str
        - end_date: str
        - model: str (model name used)
    
    Raises:
        OllamaTimeoutError: If request times out
        OllamaUnavailableError: If server unreachable
        OllamaInvalidResponseError: If response is invalid
        ValueError: If no memories or invalid date range
    """
    if not memories_data:
        raise ValueError("No memories found in the selected period.")
    
    if len(memories_data) > 50:
        # Limit to most recent 50 memories to avoid token limit
        memories_data = memories_data[:50]
    
    # Build context from memories
    memory_summaries = []
    for i, mem in enumerate(memories_data, 1):
        title = mem.get("title", "").strip()[:100]
        description = mem.get("description", "").strip()[:300]
        category = mem.get("category", "").strip()[:50]
        location = mem.get("location", "").strip()[:50]
        tags = mem.get("tags", [])
        
        tag_str = ", ".join(tags[:3]) if tags else ""
        
        parts = [title, description]
        if category:
            parts.append(f"(Catégorie: {category})")
        if location:
            parts.append(f"(Lieu: {location})")
        if tag_str:
            parts.append(f"[Tags: {tag_str}]")
        
        summary = " ".join(p for p in parts if p)
        memory_summaries.append(f"{i}. {summary}")
    
    memories_context = "\n".join(memory_summaries)
    
    # Determine period label
    period_label = {
        "month": "ce mois",
        "year": "cette année",
        "custom": "cette période"
    }.get(period_type, "cette période")
    
    prompt = f"""Tu rédiges une synthèse descriptive pour un journal personnel basée sur les souvenirs enregistrés.

TÂCHE:
Analyse les souvenirs ci-dessous et écris une synthèse cohérente de {period_label} ({start_date} à {end_date}).

RÈGLES ESSENTIELLES:
- Écris en français.
- N'utilise QUE les informations présentes dans les souvenirs fournis.
- N'invente AUCUN événement, personne, lieu, date ou expérience.
- Décris les thèmes, expériences significatives et moments importants soutenus par les souvenirs.
- Si les souvenirs contiennent peu d'informations, reconnais cette limitation explicitement.
- Reste neutre, respectueux et non-jugmental.
- Longueur: 3-8 phrases maximum.
- N'inclus pas de Markdown ou de formatage spécial.
- Réponds UNIQUEMENT avec le texte de la synthèse, rien d'autre.

SOUVENIRS ({len(memories_data)} souvenir(s)):
{memories_context}

Synthèse de {period_label}:
"""
    
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_predict": 500
        }
    }
    
    try:
        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=OLLAMA_TIMEOUT
        )
        response.raise_for_status()
        
        result = response.json()
        summary_text = result.get("response", "").strip()
        
        if not summary_text:
            raise OllamaInvalidResponseError("Ollama returned empty response")
        
        # Validate summary is reasonable length
        if len(summary_text) < 30:
            raise OllamaInvalidResponseError("Generated summary is too short")
        
        if len(summary_text) > 2000:
            summary_text = summary_text[:2000].strip()
        
        return {
            "summary": summary_text,
            "memory_count": len(memories_data),
            "period_type": period_type,
            "start_date": start_date,
            "end_date": end_date,
            "model": OLLAMA_MODEL
        }
    
    except requests.exceptions.Timeout:
        logger.error("Ollama request timed out for period insights generation")
        raise OllamaTimeoutError("AI service timed out. Try again.")
    
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Cannot connect to Ollama for period insights: {str(e)}")
        raise OllamaUnavailableError(
            "AI service unavailable. Check that Ollama is running."
        )
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Ollama request failed for period insights: {str(e)}")
        raise OllamaUnavailableError(
            "AI service error. Try again later."
        )


def expand_search_query(query: str) -> Dict[str, any]:
    """
    Expand and understand a natural language search query using Ollama.
    
    Takes a natural French memory search query and uses Ollama to:
    - Extract keywords
    - Detect memory categories
    - Identify tags
    - Detect locations
    - Generate expanded terms and synonyms
    
    Args:
        query: Natural language search query (required, non-empty)
    
    Returns:
        Dict with:
        - keywords: List[str] (extracted main search terms)
        - categories: List[str] (detected memory categories)
        - tags: List[str] (detected memory tags)
        - locations: List[str] (detected locations)
        - expanded_terms: List[str] (synonyms and related words)
        - importance: List[str] (importance levels if detected)
        - time_hints: List[str] (temporal hints like "été", "hiver")
    
    Raises:
        OllamaTimeoutError: If request times out
        OllamaUnavailableError: If server unreachable
        OllamaInvalidResponseError: If response is invalid JSON
        ValueError: If query is empty
    """
    if not query or not query.strip():
        raise ValueError("Query cannot be empty")
    
    # Truncate very long queries
    query = query[:500].strip()
    
    valid_categories_str = ", ".join(VALID_CATEGORIES)
    
    prompt = f"""You are an AI assistant that helps users search their personal memories.

TASK:
Analyze the following natural language search query and extract structured search criteria.

VALID MEMORY CATEGORIES:
{valid_categories_str}

VALID IMPORTANCE LEVELS:
very-high, high, medium, low

SEARCH QUERY:
{query}

RESPONSE FORMAT:
Return ONLY valid JSON with these exact fields:
{{
  "keywords": ["main", "search", "terms"],
  "categories": ["Category1", "Category2"],
  "tags": ["tag1", "tag2"],
  "locations": ["location1", "location2"],
  "expanded_terms": ["synonym1", "related_term", "variation"],
  "importance": ["high", "medium"],
  "time_hints": ["season", "month", "era"]
}}

RULES:
- keywords: Extract main search terms from the query (lowercase, no duplicates)
- categories: Only include from VALID MEMORY CATEGORIES; leave empty if none detected
- tags: Generate relevant tags based on query content (lowercase, max 5)
- locations: Extract location names if mentioned (empty if none)
- expanded_terms: Generate 3-5 synonyms, related words, or expanded concepts
- importance: Only include if explicitly mentioned or strongly implied (e.g., "important", "big moment")
- time_hints: Temporal references like seasons (été, hiver), months, or eras
- All lists must be arrays, even if empty
- Return only JSON, no other text
- Do NOT invent information not present in the query
"""
    
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.2,
            "num_predict": 400
        }
    }
    
    try:
        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=OLLAMA_TIMEOUT
        )
        response.raise_for_status()
        
        result = response.json()
        ai_text = result.get("response", "").strip()
        
        # Parse JSON response
        try:
            expansion = json.loads(ai_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Ollama search expansion response: {ai_text}")
            raise OllamaInvalidResponseError(
                f"Ollama returned invalid JSON for search expansion: {str(e)}"
            )
        
        # Validate and clean response
        required_fields = ["keywords", "categories", "tags", "locations", "expanded_terms", "importance", "time_hints"]
        for field in required_fields:
            if field not in expansion:
                expansion[field] = []
            
            # Ensure all fields are lists
            if not isinstance(expansion[field], list):
                expansion[field] = []
            
            # Clean: convert to strings, lowercase, remove empty/duplicates
            expansion[field] = list(set(
                str(item).strip().lower() 
                for item in expansion[field] 
                if item and str(item).strip()
            ))
        
        # Validate categories are in allowed list
        valid_cats = [c.lower() for c in VALID_CATEGORIES]
        expansion["categories"] = [
            cat for cat in expansion["categories"]
            if cat.lower() in valid_cats
        ]
        
        # Validate importance levels
        valid_importance = ["very-high", "high", "medium", "low"]
        expansion["importance"] = [
            imp for imp in expansion["importance"]
            if imp in valid_importance
        ]
        
        # Limit list sizes
        expansion["keywords"] = expansion["keywords"][:10]
        expansion["tags"] = expansion["tags"][:8]
        expansion["locations"] = expansion["locations"][:5]
        expansion["expanded_terms"] = expansion["expanded_terms"][:10]
        expansion["time_hints"] = expansion["time_hints"][:5]
        
        logger.info(f"Search query expanded: {expansion}")
        
        return expansion
    
    except requests.exceptions.Timeout:
        logger.error("Ollama request timed out for search expansion")
        raise OllamaTimeoutError("Search expansion timed out. Try again.")
    
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Cannot connect to Ollama for search expansion: {str(e)}")
        raise OllamaUnavailableError(
            "AI service unavailable. Try again later."
        )
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Ollama request failed for search expansion: {str(e)}")
        raise OllamaUnavailableError(
            "AI service error. Try again later."
        )
