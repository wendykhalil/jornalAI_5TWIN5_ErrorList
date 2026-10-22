#!/usr/bin/env python
"""
Test script for real Ollama integration.
Run this manually if Ollama server is available.

Usage:
    python test_ollama_real.py
"""

import os
import sys
import requests
import json
import django

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from apps.memories.ai_service import expand_search_query, OllamaUnavailableError

def test_ollama_available():
    """Check if Ollama server is accessible."""
    try:
        response = requests.get("http://127.0.0.1:11434/api/tags", timeout=5)
        models = response.json().get("models", [])
        print(f"✓ Ollama server is accessible")
        print(f"  Available models: {len(models)}")
        for model in models:
            print(f"    - {model.get('name', 'unknown')}")
        return True
    except requests.exceptions.ConnectionError:
        print("✗ Ollama server not accessible at http://127.0.0.1:11434")
        return False
    except Exception as e:
        print(f"✗ Error checking Ollama: {e}")
        return False

def test_search_expansion():
    """Test the search query expansion with real Ollama."""
    print("\n" + "="*60)
    print("Testing: expand_search_query() with real Ollama")
    print("="*60)
    
    test_queries = [
        "Mes souvenirs de vacances en été",
        "Les moments importants de mes études",
        "Les souvenirs liés à mes amis",
        "Les événements à Sousse",
    ]
    
    for query in test_queries:
        print(f"\n📝 Query: {query}")
        try:
            result = expand_search_query(query)
            print(f"  ✓ Expansion successful")
            print(f"    - Keywords: {result.get('keywords', [])}")
            print(f"    - Categories: {result.get('categories', [])}")
            print(f"    - Tags: {result.get('tags', [])}")
            print(f"    - Locations: {result.get('locations', [])}")
            print(f"    - Expanded terms: {result.get('expanded_terms', [])}")
            print(f"    - Importance: {result.get('importance', [])}")
            print(f"    - Time hints: {result.get('time_hints', [])}")
        except OllamaUnavailableError as e:
            print(f"  ✗ Ollama unavailable: {e}")
            return False
        except Exception as e:
            print(f"  ✗ Error: {e}")
            return False
    
    return True

def main():
    print("Ollama Real Integration Test")
    print("="*60)
    
    # Check if Ollama is available
    if not test_ollama_available():
        print("\n⚠️  Ollama server is not running.")
        print("   To test with real Ollama, start it first:")
        print("   ollama serve")
        print("\n   For now, the implementation uses mocked tests.")
        return 1
    
    # Test search expansion
    if not test_search_expansion():
        print("\n✗ Real Ollama integration test failed")
        return 1
    
    print("\n" + "="*60)
    print("✅ Real Ollama integration test PASSED")
    print("="*60)
    return 0

if __name__ == "__main__":
    sys.exit(main())
