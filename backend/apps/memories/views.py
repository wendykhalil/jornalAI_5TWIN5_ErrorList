from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Memory
from .serializers import MemorySerializer
from .ai_service import (
    suggest_category,
    suggest_tags,
    generate_summary,
    expand_search_query,
    OllamaError,
    OllamaTimeoutError,
    OllamaUnavailableError,
    OllamaInvalidResponseError,
)


class MemoryViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for managing memories.
    
    Features:
    - JWT authentication required
    - User isolation: users only see their own memories
    - Auto-set owner on creation
    - Standard CRUD operations with DefaultRouter
    - AI suggestions for categories and tags via custom actions
    """
    serializer_class = MemorySerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter memories to current user only."""
        return Memory.objects.filter(
            user=self.request.user
        ).order_by("-event_date", "-created_at")
    
    def perform_create(self, serializer):
        """Auto-set the current user as the memory owner."""
        serializer.save(user=self.request.user)
    
    # ==========================================
    # AI SUGGESTION ENDPOINTS
    # ==========================================
    
    @action(
        detail=False,
        methods=["post"],
        url_path="ai/suggest-category",
        url_name="suggest-category"
    )
    def suggest_category_action(self, request):
        """
        Suggest a memory category based on description.
        
        POST /api/memories/ai/suggest-category/
        
        Request body:
        {
            "description": "string (required, non-empty)"
        }
        
        Response:
        {
            "suggested_category": "one of the valid categories",
            "confidence": 0.0-1.0,
            "reasoning": "explanation"
        }
        
        Error responses:
        - 400: Invalid input (empty description)
        - 503: Ollama unavailable
        - 504: Ollama timeout
        - 500: Other errors
        """
        description = request.data.get("description", "").strip()
        
        if not description:
            return Response(
                {"error": "Description is required and cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            result = suggest_category(description)
            return Response(result, status=status.HTTP_200_OK)
        
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except OllamaTimeoutError as e:
            return Response(
                {"error": str(e), "type": "timeout"},
                status=status.HTTP_504_GATEWAY_TIMEOUT
            )
        
        except OllamaUnavailableError as e:
            return Response(
                {"error": str(e), "type": "unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        except OllamaInvalidResponseError as e:
            return Response(
                {"error": str(e), "type": "invalid_response"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        except OllamaError as e:
            return Response(
                {"error": str(e), "type": "ollama_error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(
        detail=False,
        methods=["post"],
        url_path="ai/suggest-tags",
        url_name="suggest-tags"
    )
    def suggest_tags_action(self, request):
        """
        Suggest memory tags based on title and description.
        
        POST /api/memories/ai/suggest-tags/
        
        Request body:
        {
            "title": "string (required, non-empty)",
            "description": "string (required, non-empty)"
        }
        
        Response:
        {
            "suggested_tags": ["tag1", "tag2", "tag3"],
            "confidence": 0.0-1.0
        }
        
        Error responses:
        - 400: Invalid input (empty title or description)
        - 503: Ollama unavailable
        - 504: Ollama timeout
        - 500: Other errors
        """
        title = request.data.get("title", "").strip()
        description = request.data.get("description", "").strip()
        
        if not title:
            return Response(
                {"error": "Title is required and cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not description:
            return Response(
                {"error": "Description is required and cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            result = suggest_tags(title, description)
            return Response(result, status=status.HTTP_200_OK)
        
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except OllamaTimeoutError as e:
            return Response(
                {"error": str(e), "type": "timeout"},
                status=status.HTTP_504_GATEWAY_TIMEOUT
            )
        
        except OllamaUnavailableError as e:
            return Response(
                {"error": str(e), "type": "unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        except OllamaInvalidResponseError as e:
            return Response(
                {"error": str(e), "type": "invalid_response"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        except OllamaError as e:
            return Response(
                {"error": str(e), "type": "ollama_error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(
        detail=False,
        methods=["post"],
        url_path="ai/generate-summary",
        url_name="generate-summary"
    )
    def generate_summary_action(self, request):
        """
        Generate a concise AI summary for a memory using Ollama.
        
        POST /api/memories/ai/generate-summary/
        
        Request body:
        {
            "title": "string (required, non-empty)",
            "description": "string (required, non-empty)",
            "category": "string (optional)",
            "tags": ["tag1", "tag2"] (optional),
            "location": "string (optional)"
        }
        
        Response:
        {
            "summary": "2-4 sentence French summary",
            "model": "qwen2.5:3b"
        }
        
        Error responses:
        - 400: Invalid input (empty title or description)
        - 503: Ollama unavailable
        - 504: Ollama timeout
        - 500: Other errors
        """
        title = request.data.get("title", "").strip()
        description = request.data.get("description", "").strip()
        
        if not title:
            return Response(
                {"error": "Title is required and cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not description:
            return Response(
                {"error": "Description is required and cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        category = request.data.get("category", "").strip() or None
        tags = request.data.get("tags", None)
        location = request.data.get("location", "").strip() or None
        
        try:
            result = generate_summary(
                title=title,
                description=description,
                category=category,
                tags=tags,
                location=location
            )
            return Response(result, status=status.HTTP_200_OK)
        
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except OllamaTimeoutError as e:
            return Response(
                {"error": str(e), "type": "timeout"},
                status=status.HTTP_504_GATEWAY_TIMEOUT
            )
        
        except OllamaUnavailableError as e:
            return Response(
                {"error": str(e), "type": "unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        except OllamaInvalidResponseError as e:
            return Response(
                {"error": str(e), "type": "invalid_response"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        except OllamaError as e:
            return Response(
                {"error": str(e), "type": "ollama_error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # ==========================================
    # INTELLIGENT SEARCH ENDPOINT
    # ==========================================
    
    @action(
        detail=False,
        methods=["post"],
        url_path="ai/search",
        url_name="intelligent-search"
    )
    def intelligent_search_action(self, request):
        """
        Perform intelligent search on user's memories using Ollama query expansion.
        
        POST /api/memories/ai/search/
        
        Request body:
        {
            "query": "Natural language search query (required, non-empty)"
        }
        
        Response:
        {
            "query": "original query",
            "results": [
                {
                    "id": "uuid",
                    "title": "...",
                    "description": "...",
                    "relevance_score": 0.0-1.0,
                    "match_types": ["title", "tags", "category"],
                    ... (full memory object)
                },
                ...
            ],
            "count": 5,
            "expansion": {
                "keywords": [...],
                "categories": [...],
                "tags": [...],
                "locations": [...],
                "expanded_terms": [...],
                "importance": [...],
                "time_hints": [...]
            },
            "search_method": "intelligent"
        }
        
        Error responses:
        - 400: Invalid input (empty query)
        - 503: Ollama unavailable
        - 504: Ollama timeout
        - 500: Other errors
        """
        query = request.data.get("query", "").strip()
        
        if not query:
            return Response(
                {"error": "Query is required and cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Step 1: Expand query using Ollama
            expansion = expand_search_query(query)
            
            # Step 2: Get current user's memories
            memories = self.get_queryset()
            
            # Step 3: Score and rank memories
            scored_results = []
            
            for memory in memories:
                score, match_types = self._calculate_relevance_score(
                    memory,
                    expansion,
                    query
                )
                
                # Apply minimum relevance threshold to filter out weak matches
                # 0.3 = 30% of max possible score (eliminates false positives from overly broad queries)
                MINIMUM_RELEVANCE_THRESHOLD = 0.3
                
                if score >= MINIMUM_RELEVANCE_THRESHOLD:
                    scored_results.append({
                        "memory": memory,
                        "score": score,
                        "match_types": match_types
                    })
            
            # Step 4: Sort by score descending and limit to 10
            scored_results.sort(key=lambda x: x["score"], reverse=True)
            scored_results = scored_results[:10]
            
            # Step 5: Serialize results
            serializer = MemorySerializer(
                [r["memory"] for r in scored_results],
                many=True
            )
            
            # Attach relevance scores to serialized data
            results_with_scores = []
            for serialized, scored in zip(serializer.data, scored_results):
                serialized["relevance_score"] = round(scored["score"], 2)
                serialized["match_types"] = scored["match_types"]
                results_with_scores.append(serialized)
            
            return Response({
                "query": query,
                "results": results_with_scores,
                "count": len(results_with_scores),
                "expansion": expansion,
                "search_method": "intelligent"
            }, status=status.HTTP_200_OK)
        
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except OllamaTimeoutError as e:
            return Response(
                {"error": str(e), "type": "timeout"},
                status=status.HTTP_504_GATEWAY_TIMEOUT
            )
        
        except OllamaUnavailableError as e:
            return Response(
                {"error": str(e), "type": "unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        except OllamaInvalidResponseError as e:
            return Response(
                {"error": str(e), "type": "invalid_response"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        except OllamaError as e:
            return Response(
                {"error": str(e), "type": "ollama_error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _calculate_relevance_score(self, memory, expansion, original_query):
        """
        Calculate relevance score for a memory against expanded query criteria.
        
        Scoring weights:
        - Title exact/word match: +5 points
        - Description word match: +3 points
        - Category match: +4 points
        - Tag exact match: +3 points
        - Location exact match: +3 points
        - Expanded term match: +2 points
        - Importance match: +2 points
        
        Returns:
            Tuple of (score, match_types_list)
        """
        score = 0.0
        match_types = []
        
        query_lower = original_query.lower()
        title_lower = (memory.title or "").lower()
        description_lower = (memory.description or "").lower()
        location_lower = (memory.location or "").lower()
        category_lower = (memory.category or "").lower()
        tags_lower = [t.lower() for t in (memory.tags or [])]
        
        # 1. Title matching
        if title_lower in query_lower or query_lower in title_lower:
            score += 5
            match_types.append("title_exact")
        else:
            for keyword in expansion.get("keywords", []):
                if keyword in title_lower:
                    score += 3
                    match_types.append("title")
                    break
        
        # 2. Description matching
        for keyword in expansion.get("keywords", []):
            if keyword in description_lower:
                score += 3
                match_types.append("description")
                break
        
        # 3. Category matching
        for category in expansion.get("categories", []):
            if category.lower() == category_lower:
                score += 4
                match_types.append("category")
                break
        
        # 4. Tag exact matching
        matched_tags = []
        for tag in expansion.get("tags", []):
            if tag in tags_lower:
                score += 3
                matched_tags.append(tag)
        if matched_tags:
            match_types.append("tags")
        
        # 5. Location matching
        for location in expansion.get("locations", []):
            if location.lower() == location_lower and location_lower:
                score += 3
                match_types.append("location")
                break
        
        # 6. Expanded terms matching
        for term in expansion.get("expanded_terms", []):
            if term in title_lower or term in description_lower:
                score += 2
                match_types.append("expanded")
                break
        
        # 7. Importance matching
        if expansion.get("importance"):
            memory_importance = (memory.importance or "").lower()
            for imp in expansion.get("importance", []):
                if imp.lower() == memory_importance:
                    score += 2
                    match_types.append("importance")
                    break
        
        # Normalize score to 0-1 range (max theoretical score is ~25)
        normalized_score = min(score / 25.0, 1.0)
        
        # Remove duplicates from match_types
        match_types = list(set(match_types))
        
        return normalized_score, match_types
