import requests
import json
import os

GRAPHQL_URL = "https://worldathletics.org/api/graphql"

def get_rankings():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Content-Type": "application/json"
    }
    
    # GraphQL Query für Weitsprung Männer
    query = """
    query GetWorldRankings($eventGroup: String, $gender: GenderType, $limit: Int) {
      singleEventRankings(eventGroup: $eventGroup, gender: $gender, limit: $limit) {
        rankings {
          rank
          athlete {
            id
            name
            country
            urlSlug
          }
          rankingScore
          resultScores {
            competition
            venue
            date
            mark
            wind
            place
            category
            resultScore
            placingScore
            totalScore
          }
        }
      }
    }
    """
    
    variables = {
        "eventGroup": "long-jump",
        "gender": "MEN",
        "limit": 80
    }
    
    response = requests.post(GRAPHQL_URL, json={"query": query, "variables": variables}, headers=headers)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Fehler beim Abruf: {response.status_code}")
        return None

if __name__ == "__main__":
    data = get_rankings()
    if data:
        # Erstelle den Ordner 'data', falls er nicht existiert
        os.makedirs("data", exist_ok=True)
        with open("data/ranking_latest.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Erfolgreich in data/ranking_latest.json gespeichert!")
