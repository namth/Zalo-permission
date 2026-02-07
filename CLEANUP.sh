#!/bin/bash

# Cleanup Script - Remove unnecessary files
# Keeps only essential system documentation and code

set -e

echo "=========================================="
echo "Cleaning up unnecessary files..."
echo "=========================================="
echo ""

# Root directory - files to remove
echo "Removing backup files..."
rm -f backup_*.sql
echo "✓ Removed backup_*.sql"

echo ""
echo "Removing migration helper scripts..."
rm -f run-migration.sh
rm -f run-all-migrations.sh
echo "✓ Removed migration scripts"

echo ""
echo "Removing temporary/intermediate documentation..."
# Keep: README.md, API.md, AUTH.md, SYSTEM_OVERVIEW.md, database3.md, structure-design.md
rm -f QUICK_MIGRATE.md
rm -f DATABASE_UPDATE_GUIDE.md
rm -f MIGRATION_QUICK_START.md
rm -f CHANGELOG_V2.md
rm -f DEPRECATION_NOTICE.md
rm -f IMPLEMENTATION_PLAN.md
rm -f IMPLEMENTATION_SUMMARY.md
rm -f REFACTORING_DONE.md
rm -f REFACTORING_SUMMARY.md
rm -f UPDATE_SUMMARY.md
rm -f PROJECT_STRUCTURE.md
rm -f DOMAIN_SETUP.md
rm -f DEPLOY_GUIDE.md
echo "✓ Removed temporary documentation"

echo ""
echo "Removing old migration files..."
cd backend/src/lib/migrations

# Remove backup files
rm -f _*.sql.bak
echo "✓ Removed .bak files"

# Remove duplicate/intermediate migration files
rm -f 002-add-agent-to-zalo-groups.sql
rm -f 002-drop-workspace-agent-config.sql
echo "✓ Removed duplicate migration files"

cd - > /dev/null

echo ""
echo "=========================================="
echo "Cleanup completed!"
echo "=========================================="
echo ""
echo "Kept essential files:"
echo "  ✓ README.md - Project overview"
echo "  ✓ API.md - API documentation"
echo "  ✓ AUTH.md - Authentication logic"
echo "  ✓ SYSTEM_OVERVIEW.md - Architecture"
echo "  ✓ database3.md - Database design"
echo "  ✓ structure-design.md - System design"
echo "  ✓ prd3.md - Product requirements"
echo "  ✓ USER_API_QUICK_REFERENCE.md - API quick ref"
echo "  ✓ neo4j-init.cypher - Neo4j setup"
echo "  ✓ docker-compose.yml - Docker config"
echo ""
echo "Kept migration files:"
echo "  ✓ 001-fresh-schema-v3.sql"
echo "  ✓ 002a-drop-workspace-agent-config.sql"
echo "  ✓ 002b-add-agent-to-zalo-groups.sql"
echo "  ✓ 003-populate-sample-data.sql"
echo ""
