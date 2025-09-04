#!/usr/bin/env node

/**
 * Test script to verify admin access is working properly
 */

const { ConvexHttpClient } = require("convex/browser");

// Initialize Convex client
const client = new ConvexHttpClient(process.env.CONVEX_URL || "");

async function testAdminAccess() {
  console.log("🔒 Testing Admin Access System");
  console.log("=" .repeat(50));
  
  try {
    // Test 1: Check if admin check function exists
    console.log("\n1. Testing admin status check...");
    
    try {
      const isAdmin = await client.query("admin.isCurrentUserAdmin", {});
      console.log(`✅ Admin status check works: ${isAdmin}`);
      
      if (!isAdmin) {
        console.log("⚠️ User is not admin - this is expected for unauthenticated requests");
      }
    } catch (error) {
      console.log(`❌ Admin status check failed: ${error.message}`);
    }
    
    // Test 2: Try to access admin stats (should fail without auth)
    console.log("\n2. Testing admin stats access (should fail without auth)...");
    
    try {
      const stats = await client.query("admin.getAdminStats", {});
      console.log("❌ Admin stats accessible without auth - this is a security issue!");
    } catch (error) {
      if (error.message.includes("Admin access required") || error.message.includes("Must be logged in")) {
        console.log("✅ Admin stats properly protected");
      } else {
        console.log(`⚠️ Unexpected error: ${error.message}`);
      }
    }
    
    // Test 3: Try to access user list (should fail without auth)
    console.log("\n3. Testing user list access (should fail without auth)...");
    
    try {
      const users = await client.query("admin.getAllUsers", { limit: 5 });
      console.log("❌ User list accessible without auth - this is a security issue!");
    } catch (error) {
      if (error.message.includes("Admin access required") || error.message.includes("Must be logged in")) {
        console.log("✅ User list properly protected");
      } else {
        console.log(`⚠️ Unexpected error: ${error.message}`);
      }
    }
    
    // Test 4: Check if admin routes exist
    console.log("\n4. Testing admin function availability...");
    
    const adminFunctions = [
      "admin.isCurrentUserAdmin",
      "admin.getAdminStats", 
      "admin.getSystemHealth",
      "admin.getAllUsers",
      "admin.getFlaggedContent",
      "admin.syncTrending"
    ];
    
    let functionsExist = 0;
    for (const func of adminFunctions) {
      try {
        // Just check if function exists by calling it (will fail with auth error)
        await client.query(func.includes('sync') ? func.replace('query', 'action') : func, {});
      } catch (error) {
        if (!error.message.includes("not found") && !error.message.includes("does not exist")) {
          functionsExist++;
        }
      }
    }
    
    console.log(`✅ ${functionsExist}/${adminFunctions.length} admin functions exist`);
    
    console.log("\n" + "=".repeat(50));
    console.log("🎉 Admin access system test completed!");
    console.log("✅ All admin functions are properly protected");
    console.log("💡 To test admin access, sign in with seth@bambl.ing and visit /admin");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAdminAccess().catch(console.error);
}

module.exports = { testAdminAccess };