#!/bin/bash
set -e

# Run database migrations
echo "🔄 Running database migrations..."

# Database connection parameters
DB_HOST=${DATABASE_HOST:-"localhost"}
DB_PORT=${DATABASE_PORT:-"5432"}
DB_USER=${DATABASE_USER:-"postgres"}
DB_PASSWORD=${DATABASE_PASSWORD:-"postgres"}
DB_NAME=${DATABASE_NAME:-"udagram"}

# Migration directory
MIGRATION_DIR="./migrations"

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

echo "Connecting to PostgreSQL at $DB_HOST:$DB_PORT..."

# Create database if it doesn't exist
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $DB_NAME"

echo "Running migrations..."

# Run each migration file in order
for migration in $(ls -1 "$MIGRATION_DIR"/*.sql | sort); do
    MIGRATION_NAME=$(basename "$migration")
    echo "  Applying: $MIGRATION_NAME"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration"
done

echo ""
echo "✅ Migrations completed successfully!"
