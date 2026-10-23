from rest_framework import viewsets, status
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
    generate_period_insights,
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

    @action(
        detail=True,
        methods=["post"],
        url_path="save-summary",
        url_name="save-summary"
    )
    def save_summary_action(self, request, pk=None):
        """
        Save an AI-generated summary to a memory's ai_summary field.
        
        POST /api/memories/{id}/save-summary/
        
        Request body:
        {
            "summary": "string (required, non-empty, max 1000 chars)"
        }
        
        Response (200 OK):
        {
            "id": "memory_id",
            "ai_summary": "saved summary",
            "message": "Summary saved successfully"
        }
        
        Error responses:
        - 400: Invalid input (empty or missing summary, exceeds max length)
        - 401: Not authenticated
        - 403: User does not own this memory
        - 404: Memory not found
        """
        # Get memory by pk without filtering by current user
        # This allows us to distinguish between 403 (unauthorized) and 404 (not found)
        try:
            memory = Memory.objects.get(pk=pk)
        except Memory.DoesNotExist:
            return Response(
                {"error": "Memory not found."},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Authorization check: user must own the memory
        if memory.user != request.user:
            return Response(
                {"error": "You do not have permission to update this memory."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        summary = request.data.get("summary", "").strip()
        
        if not summary:
            return Response(
                {"error": "Summary is required and cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(summary) > 1000:
            return Response(
                {"error": "Summary must not exceed 1000 characters."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            memory.ai_summary = summary
            memory.save(update_fields=['ai_summary'])
            
            return Response({
                "id": memory.id,
                "ai_summary": memory.ai_summary,
                "message": "Summary saved successfully"
            }, status=status.HTTP_200_OK)
        
        except Exception as e:
            return Response(
                {"error": f"Failed to save summary: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # ==========================================
    # PERIOD INSIGHTS ENDPOINT
    # ==========================================
    
    @action(
        detail=False,
        methods=["post"],
        url_path="ai/insights",
        url_name="period-insights"
    )
    def period_insights_action(self, request):
        """
        Generate an AI-powered summary of memories for a date period.
        
        POST /api/memories/ai/insights/
        
        Request body:
        {
            "start_date": "2026-01-01" (required, YYYY-MM-DD format),
            "end_date": "2026-12-31" (required, YYYY-MM-DD format),
            "period_type": "year" (optional: "year", "month", "custom"; defaults to "custom")
        }
        
        Response:
        {
            "summary": "2-8 sentence French summary of the period",
            "memory_count": 8,
            "period_type": "year",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "model": "qwen2.5:3b"
        }
        
        Error responses:
        - 400: Invalid input (missing dates, empty period, invalid format)
        - 503: Ollama unavailable
        - 504: Ollama timeout
        - 500: Other errors
        """
        start_date = request.data.get("start_date", "").strip()
        end_date = request.data.get("end_date", "").strip()
        period_type = request.data.get("period_type", "custom").strip()
        
        # Validate inputs
        if not start_date:
            return Response(
                {"error": "start_date is required (format: YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not end_date:
            return Response(
                {"error": "end_date is required (format: YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if period_type not in ("year", "month", "custom"):
            return Response(
                {"error": "period_type must be 'year', 'month', or 'custom'."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate date format
        try:
            from datetime import datetime
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {"error": "Dates must be in YYYY-MM-DD format."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if start_dt > end_dt:
            return Response(
                {"error": "start_date must be before or equal to end_date."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Fetch current user's memories in the date range
            memories = self.get_queryset().filter(
                event_date__gte=start_dt,
                event_date__lte=end_dt,
                draft=False  # Only published memories
            ).order_by("-event_date")
            
            if not memories.exists():
                return Response(
                    {
                        "summary": "Aucun souvenir ne correspond à cette période. Choisissez une autre plage pour générer un résumé.",
                        "memory_count": 0,
                        "period_type": period_type,
                        "start_date": start_date,
                        "end_date": end_date,
                        "model": None
                    },
                    status=status.HTTP_200_OK
                )
            
            # Convert memories to dicts for AI service
            serializer = MemorySerializer(memories, many=True)
            memories_data = serializer.data
            
            # Generate AI summary
            result = generate_period_insights(
                memories_data=memories_data,
                start_date=start_date,
                end_date=end_date,
                period_type=period_type
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
