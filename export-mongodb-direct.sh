#!/bin/bash

# MongoDB Atlas connection details
MONGO_URI="mongodb+srv://ayushsharma2440:ayush@sabrang.icpskhz.mongodb.net/sabrang"

# Get current date for filenames
DATE=$(date +%Y-%m-%d)

echo "🚀 Starting MongoDB Export for Sabrang Registrations..."
echo "📅 Date: $DATE"
echo "🔗 Database: sabrang"
echo ""

# Export Users collection with selected fields
echo "👤 Exporting Users collection..."
mongoexport --uri="$MONGO_URI" \
  --collection=users \
  --type=csv \
  --fields=name,email,contactNo,events \
  --out="users_${DATE}.csv"

if [ $? -eq 0 ]; then
    echo "✅ Users export completed: users_${DATE}.csv"
else
    echo "❌ Users export failed"
fi

# Export Team Compositions collection (JSON format to capture nested arrays)
echo ""
echo "👥 Exporting Team Compositions collection..."
mongoexport --uri="$MONGO_URI" \
  --collection=teamcompositions \
  --type=json \
  --out="teamcompositions_${DATE}.json"

if [ $? -eq 0 ]; then
    echo "✅ Team Compositions export completed: teamcompositions_${DATE}.json"
else
    echo "❌ Team Compositions export failed"
fi

# Export Purchases collection for payment verification
echo ""
echo "💳 Exporting Purchases collection..."
mongoexport --uri="$MONGO_URI" \
  --collection=purchases \
  --type=csv \
  --fields=userDetails.name,userDetails.email,userDetails.contactNo,items.itemName,paymentStatus,totalAmount,orderId \
  --out="purchases_${DATE}.csv"

if [ $? -eq 0 ]; then
    echo "✅ Purchases export completed: purchases_${DATE}.csv"
else
    echo "❌ Purchases export failed"
fi

# Process team compositions JSON to detailed CSV
echo ""
echo "🔄 Processing team compositions data..."
if [ -f "teamcompositions_${DATE}.json" ]; then
    node process-team-compositions.js
else
    echo "⚠️ Team compositions JSON file not found, skipping processing"
fi

echo ""
echo "📊 Export Summary:"
echo "=================="
if [ -f "users_${DATE}.csv" ]; then
    user_count=$(tail -n +2 "users_${DATE}.csv" | wc -l)
    echo "👤 Users exported: $user_count"
fi

if [ -f "teamcompositions_${DATE}_detailed.csv" ]; then
    team_count=$(tail -n +2 "teamcompositions_${DATE}_detailed.csv" | wc -l)
    echo "👥 Team members exported: $team_count"
fi

if [ -f "purchases_${DATE}.csv" ]; then
    purchase_count=$(tail -n +2 "purchases_${DATE}.csv" | wc -l)
    echo "💳 Purchases exported: $purchase_count"
fi
echo "=================="
echo ""
echo "📁 Files created in current directory:"
ls -la *${DATE}.csv *${DATE}.json 2>/dev/null || echo "No export files found"
echo ""
echo "✅ MongoDB export completed!"
echo ""
echo "📋 Key files to use:"
echo "   📄 users_${DATE}.csv - Individual registrations (name, email, mobile, events)"
echo "   📄 teamcompositions_${DATE}_detailed.csv - Team registrations with all member details"
echo "   📄 purchases_${DATE}.csv - Payment verification data"