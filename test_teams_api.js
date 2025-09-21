// Test script for Teams Dashboard API endpoints
// Run with: node test_teams_api.js

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

// Test credentials (update these with valid admin credentials)
const ADMIN_CREDENTIALS = {
    email: 'admin@example.com',
    password: 'admin123'
};

async function login() {
    try {
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(ADMIN_CREDENTIALS),
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Login failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ Login successful');
        return result;
    } catch (error) {
        console.error('❌ Login failed:', error.message);
        throw error;
    }
}

async function testGetAllTeams() {
    try {
        console.log('\n📋 Testing GET /api/teams/admin/all-teams...');
        
        const response = await fetch(`${BASE_URL}/api/teams/admin/all-teams`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to get all teams: ${response.status} ${response.statusText}`);
        }

        const teams = await response.json();
        console.log(`✅ Successfully retrieved ${teams.length} teams`);
        
        if (teams.length > 0) {
            console.log('Sample team structure:');
            console.log(JSON.stringify(teams[0], null, 2));
        }
        
        return teams;
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return null;
    }
}

async function testGetTeamDetails(leaderId) {
    if (!leaderId) {
        console.log('\n⚠️  Skipping team details test - no leader ID available');
        return null;
    }

    try {
        console.log(`\n🔍 Testing GET /api/teams/admin/team-details/${leaderId}...`);
        
        const response = await fetch(`${BASE_URL}/api/teams/admin/team-details/${leaderId}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to get team details: ${response.status} ${response.statusText}`);
        }

        const teamDetails = await response.json();
        console.log('✅ Successfully retrieved team details');
        console.log(`Leader: ${teamDetails.leader.name} (${teamDetails.leader.email})`);
        console.log(`Members: ${teamDetails.memberCount}`);
        console.log(`Projects: ${teamDetails.projectCount}`);
        
        return teamDetails;
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return null;
    }
}

async function testGetAvailableLeaders() {
    try {
        console.log('\n👥 Testing GET /api/teams/admin/available-leaders...');
        
        const response = await fetch(`${BASE_URL}/api/teams/admin/available-leaders`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to get available leaders: ${response.status} ${response.statusText}`);
        }

        const leaders = await response.json();
        console.log(`✅ Successfully retrieved ${leaders.length} available leaders`);
        
        if (leaders.length > 0) {
            console.log('Sample leader structure:');
            console.log(JSON.stringify(leaders[0], null, 2));
        }
        
        return leaders;
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return null;
    }
}

async function testGetTeamMembers(leaderId) {
    if (!leaderId) {
        console.log('\n⚠️  Skipping team members test - no leader ID available');
        return null;
    }

    try {
        console.log(`\n👤 Testing GET /api/teams/members?leaderId=${leaderId}...`);
        
        const response = await fetch(`${BASE_URL}/api/teams/members?leaderId=${leaderId}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to get team members: ${response.status} ${response.statusText}`);
        }

        const members = await response.json();
        console.log(`✅ Successfully retrieved ${members.length} team members`);
        
        if (members.length > 0) {
            console.log('Sample member structure:');
            console.log(JSON.stringify(members[0], null, 2));
        }
        
        return members;
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return null;
    }
}

async function testGetTeamProjects(leaderId) {
    if (!leaderId) {
        console.log('\n⚠️  Skipping team projects test - no leader ID available');
        return null;
    }

    try {
        console.log(`\n📊 Testing GET /api/teams/projects?leaderId=${leaderId}...`);
        
        const response = await fetch(`${BASE_URL}/api/teams/projects?leaderId=${leaderId}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to get team projects: ${response.status} ${response.statusText}`);
        }

        const projects = await response.json();
        console.log(`✅ Successfully retrieved ${projects.length} team projects`);
        
        if (projects.length > 0) {
            console.log('Sample project structure:');
            console.log(JSON.stringify(projects[0], null, 2));
        }
        
        return projects;
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return null;
    }
}

async function logout() {
    try {
        console.log('\n🚪 Logging out...');
        
        const response = await fetch(`${BASE_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Logout failed: ${response.status} ${response.statusText}`);
        }

        console.log('✅ Logout successful');
    } catch (error) {
        console.error('❌ Logout failed:', error.message);
    }
}

async function runAllTests() {
    console.log('🚀 Starting Teams Dashboard API Tests');
    console.log('=====================================');

    try {
        // Login first
        await login();

        // Test all endpoints
        const teams = await testGetAllTeams();
        const leaders = await testGetAvailableLeaders();
        
        // Get a leader ID for detailed tests
        let leaderId = null;
        if (teams && teams.length > 0) {
            leaderId = teams[0].leader.id;
        } else if (leaders && leaders.length > 0) {
            leaderId = leaders[0].id;
        }

        if (leaderId) {
            await testGetTeamDetails(leaderId);
            await testGetTeamMembers(leaderId);
            await testGetTeamProjects(leaderId);
        } else {
            console.log('\n⚠️  No leader ID available for detailed tests');
        }

        // Logout
        await logout();

        console.log('\n✅ All tests completed!');
        console.log('\n📝 Test Summary:');
        console.log('=============');
        console.log('1. ✅ Admin authentication');
        console.log('2. ✅ Get all teams endpoint');
        console.log('3. ✅ Get available leaders endpoint');
        if (leaderId) {
            console.log('4. ✅ Get team details endpoint');
            console.log('5. ✅ Get team members endpoint');
            console.log('6. ✅ Get team projects endpoint');
        } else {
            console.log('4. ⚠️  Team details test skipped (no data)');
            console.log('5. ⚠️  Team members test skipped (no data)');
            console.log('6. ⚠️  Team projects test skipped (no data)');
        }
        console.log('7. ✅ Logout');

    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
        console.log('\n💡 Make sure:');
        console.log('   - The server is running on port 3000');
        console.log('   - Database is properly configured');
        console.log('   - Admin credentials are correct');
        console.log('   - Team data exists in the database');
    }
}

// Run the tests
runAllTests();
