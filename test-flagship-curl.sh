#!/bin/bash

echo "🧪 Testing BANDJAM registration with flagship benefits (support artists + visitors)"
echo "=========================================================================="

# Test data for BANDJAM with flagship benefits
curl -X POST http://localhost:5000/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Leader",
    "email": "leader@test.com",
    "password": "testpass123",
    "contactNo": "9876543210",
    "gender": "male",
    "age": "22",
    "universityName": "Test University",
    "address": "Test Address",
    "items": "[{\"id\": 1, \"title\": \"BANDJAM\", \"price\": 1000}]",
    "formsBySignature": "{\"BANDJAM_team\": {\"teamName\": \"Test Band\", \"name\": \"Test Leader\", \"email\": \"leader@test.com\", \"contactNo\": \"9876543210\", \"numMembers\": \"2\"}}",
    "teamMembersBySignature": "{\"BANDJAM_team\": [{\"name\": \"Member 1\", \"email\": \"member1@test.com\", \"contactNo\": \"9876543211\"}]}",
    "flagshipBenefitsByEvent": "{\"1\": {\"supportArtistQuantity\": 2, \"supportArtistDetails\": [{\"name\": \"Support Artist 1\", \"email\": \"artist1@test.com\", \"contactNo\": \"9876543220\", \"role\": \"photographer\", \"idNumber\": \"123456789\", \"idType\": \"aadhar\"}, {\"name\": \"Support Artist 2\", \"email\": \"artist2@test.com\", \"contactNo\": \"9876543221\", \"role\": \"videographer\", \"idNumber\": \"987654321\", \"idType\": \"passport\"}], \"flagshipVisitorPassQuantity\": 1, \"flagshipVisitorPassDetails\": [{\"name\": \"Visitor 1\", \"collegeMailId\": \"visitor1@test.com\", \"contactNo\": \"9876543230\", \"gender\": \"female\", \"age\": \"21\", \"universityName\": \"Visitor University\", \"address\": \"Visitor Address\"}], \"flagshipSoloVisitorPassQuantity\": 1, \"flagshipSoloVisitorPassDetails\": [{\"name\": \"Solo Visitor 1\", \"collegeMailId\": \"solo1@test.com\", \"contactNo\": \"9876543240\", \"gender\": \"male\", \"age\": \"23\", \"universityName\": \"Solo University\", \"address\": \"Solo Address\"}]}}"
  }' | jq '.'

echo ""
echo "=========================================================================="
echo "Expected outcome:"
echo "✅ Should successfully register with 6 total team members:"
echo "   - 1 Team Leader (Test Leader)"
echo "   - 1 Regular Team Member (Member 1)" 
echo "   - 2 Support Artists (Artist 1, Artist 2)"
echo "   - 1 Flagship Visitor (Visitor 1)"
echo "   - 1 Flagship Solo Visitor (Solo Visitor 1)"
echo ""
echo "✅ Should create team composition with all 6 members having valid userIds"
echo "✅ Should pass validation because flagship benefits count toward team size"
echo "=========================================================================="
