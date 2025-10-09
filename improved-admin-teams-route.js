/**
 * Improved Admin Panel Teams Route with Flexible Event Filtering
 * This patch makes the admin panel more flexible in handling event name variations
 */

// SUGGESTED REPLACEMENT for the teams route in admin.js (around line 4393)

// Get all teams with member details - IMPROVED VERSION
router.get("/teams", async (req, res) => {
  try {
    console.log('📥 GET /admin/teams - Query params:', req.query);
    
    const { 
      search, 
      eventFilter,
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      limit = 100 
    } = req.query;

    // Build query filters for teams
    const filters = {};
    
    // IMPROVED Event filter with flexible matching
    if (eventFilter && eventFilter !== 'all') {
      // Handle BAND JAM variations specifically
      if (eventFilter.toLowerCase().replace(/\s+/g, '') === 'bandjam') {
        // Match any variation of BAND JAM
        filters.eventName = { 
          $regex: new RegExp('^(band\\s*jam|bandjam)$', 'i') 
        };
        console.log('🎵 Using flexible BAND JAM matching');
      } else {
        // For other events, try both exact match and case-insensitive
        filters.$or = [
          { eventName: eventFilter }, // Exact match
          { eventName: { $regex: new RegExp(`^${eventFilter}$`, 'i') } } // Case insensitive
        ];
      }
    }
    
    // Search functionality (team name or leader name)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const searchFilters = [
        { teamName: searchRegex },
        { 'teamLeader.name': searchRegex }
      ];
      
      // If we already have event filters, combine them with AND logic
      if (filters.$or || filters.eventName) {
        filters.$and = [
          filters.$or ? { $or: filters.$or } : { eventName: filters.eventName },
          { $or: searchFilters }
        ];
        delete filters.$or;
        delete filters.eventName;
      } else {
        filters.$or = searchFilters;
      }
    }

    console.log('🔍 Final query filters:', JSON.stringify(filters, null, 2));

    // Sort options
    const sortObject = {};
    sortObject[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get teams (without populate to avoid schema issues)
    const teams = await TeamComposition.find(filters)
      .sort(sortObject)
      .limit(parseInt(limit))
      .lean();

    // Transform teams data for frontend
    const teamsWithDetails = teams.map(team => ({
      _id: team._id,
      teamName: team.teamName,
      eventName: team.eventName,
      leader: team.teamLeader ? {
        _id: team.teamLeader.userId,
        name: team.teamLeader.name,
        email: team.teamLeader.email,
        hasEntered: team.teamLeader.hasEntered || false
      } : null,
      members: (team.teamMembers || [])
        .filter(member => member && member.userId) // Filter out empty slots
        .map(member => ({
          _id: member.userId,
          name: member.name,
          email: member.email,
          hasEntered: member.hasEntered || false
        })),
      totalMembers: team.totalMembers || 0,
      registrationComplete: team.registrationComplete || false,
      paymentStatus: team.paymentStatus || 'pending',
      createdAt: team.createdAt
    }));

    console.log(`✅ Found teams: ${teamsWithDetails.length}`);

    res.json({
      success: true,
      teams: teamsWithDetails,
      totalCount: teamsWithDetails.length,
      appliedFilters: {
        eventFilter,
        search,
        actualQuery: filters
      }
    });

  } catch (error) {
    console.error('Error in teams route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});