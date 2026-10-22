#!/usr/bin/env python
"""
Test script to verify intelligent search relevance with Mars query.
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from apps.memories.ai_service import expand_search_query

def test_mars_expansion():
    """Test what Ollama returns for Mars query."""
    print("Testing Ollama expansion for Mars query...")
    print()
    
    test_queries = [
        "Mes souvenirs d'une expedition sur Mars",
        "Mes souvenirs de vacances a Bali avec mes amis",
        "Les moments importants de mes etudes",
    ]
    
    for query in test_queries:
        print(f"Query: {query}")
        try:
            result = expand_search_query(query)
            print(f"  Keywords: {result.get('keywords', [])}")
            print(f"  Categories: {result.get('categories', [])}")
            print(f"  Tags: {result.get('tags', [])}")
            print(f"  Expanded terms: {result.get('expanded_terms', [])}")
            print(f"  Importance: {result.get('importance', [])}")
            print()
        except Exception as e:
            print(f"  Error: {e}")
            print()

if __name__ == "__main__":
    test_mars_expansion()
