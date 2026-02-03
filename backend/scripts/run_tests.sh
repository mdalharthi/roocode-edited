#!/bin/bash

# Script to set up test database and run tests

set -e

echo "🧪 Running Backend Tests"
echo "======================="

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5433 > /dev/null 2>&1; then
    echo "❌ PostgreSQL test server is not running on port 5433"
    echo "Please start it with: docker-compose -f docker-compose.test.yml up -d"
    exit 1
fi

echo "✅ PostgreSQL is running"

# Set test environment variables
export TEST_DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5433/code_assistant_test"
export DATABASE_URL="$TEST_DATABASE_URL"
export API_KEY="3pYVmul0LcBSs7j-AYN4PA3jq2Q9UHlUTggb1Lup-Fk"
export ENCRYPTION_KEY="3pYVmul0LcBSs7j-AYN4PA3jq2Q9UHlUTggb1Lup-Fk="

echo "🔧 Environment configured"

# Run tests with coverage
echo "🚀 Running tests..."
cd "$(dirname "$0")/.."

if [ "$1" = "--coverage" ]; then
    pytest tests/ \
        --cov=app \
        --cov-report=term-missing \
        --cov-report=html:htmlcov \
        -v
    echo ""
    echo "📊 Coverage report generated in htmlcov/index.html"
else
    pytest tests/ -v
fi

echo ""
echo "✅ All tests completed!"
