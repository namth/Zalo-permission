#!/bin/bash

# Initialize Neo4j via cypher-shell
docker exec -i plutus-neo4j cypher-shell -u neo4j -p neo4j_password < "/Users/namtran/Local Apps/Zalo-permission/neo4j-init.cypher"

echo "✅ Neo4j initialized"
