import { io } from "socket.io-client";

console.log("Starting WebSocket Sync Test...");

const captainClient = io("http://localhost:3001");
const posClient = io("http://localhost:3001");

let testStage = 0;

captainClient.on("connect", () => {
  console.log("[Captain] Connected to server.");
  checkStart();
});

posClient.on("connect", () => {
  console.log("[POS] Connected to server.");
  checkStart();
});

let connections = 0;
function checkStart() {
  connections++;
  if (connections === 2) {
    console.log("Both clients connected. Starting test in 2 seconds...");
    setTimeout(runTest, 2000);
  }
}

async function runTest() {
  console.log("--- TEST 1: Punch Order from Captain ---");
  // Simulate Captain POSTing an order via REST
  try {
    const res = await fetch("http://localhost:3001/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table_id: "7782",
        items: [{ name: "Test Item from Captain", price: 100, quantity: 1 }]
      })
    });
    const data = await res.json();
    console.log("[Captain] Sent order via REST. Response:", data.success ? "Success" : "Failed");
  } catch (e) {
    console.error("Test 1 Failed:", e.message);
  }
}

posClient.on("order_updated", (payload) => {
  console.log(`\n[POS] 📢 Received 'order_updated' event!`);
  console.log(`[POS] Table ID: ${payload.table_id}, Status: ${payload.status}`);
  console.log(`[POS] Items received:`, payload.items);
  
  if (payload.items.find(i => i.name === "Test Item from Captain")) {
    console.log("✅ TEST 1 PASSED: POS received the order from Captain successfully via WebSockets!");
    
    // Proceed to Test 2
    setTimeout(runTest2, 2000);
  } else if (payload.items.find(i => i.name === "Test Item from POS")) {
    console.log("✅ TEST 2 PASSED: POS received its own broadcast (expected).");
  }
});

captainClient.on("order_updated", (payload) => {
  console.log(`\n[Captain] 📢 Received 'order_updated' event!`);
  
  if (payload.items.find(i => i.name === "Test Item from POS")) {
    console.log("✅ TEST 2 PASSED: Captain received the order from POS successfully via WebSockets!");
    console.log("\n🎉 ALL TESTS PASSED: Bi-directional real-time sync is working perfectly!");
    process.exit(0);
  }
});

async function runTest2() {
  console.log("\n--- TEST 2: Punch Order from POS ---");
  // Simulate POS POSTing an order update
  try {
    const res = await fetch("http://localhost:3001/api/orders/7782", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "OCCUPIED",
        items: [
          { name: "Test Item from Captain", price: 100, quantity: 1 },
          { name: "Test Item from POS", price: 50, quantity: 2 }
        ]
      })
    });
    const data = await res.json();
    console.log("[POS] Sent order update via REST. Response:", data.success ? "Success" : "Failed");
  } catch (e) {
    console.error("Test 2 Failed:", e.message);
  }
}
