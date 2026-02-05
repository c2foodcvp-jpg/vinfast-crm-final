// import fetch from 'node-fetch'; // Using native fetch

async function testPush() {
    console.log("🚀 Testing Push Notification Edge Function...");

    const url = 'https://ksrzwrizbqkjyzqhkfkn.supabase.co/functions/v1/send-push';
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzcnp3cml6YnFranl6cWhrZmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzkyMDcsImV4cCI6MjA4MjkxNTIwN30.8OxhjfjI0hqfYONKO4sC650KZO8uGNFtdwSV-2rmbEA';

    const payload = {
        record: {
            title: "🔍 Debug Push",
            content: "Testing from script (Manual Trigger)", // Note: function uses 'content' or 'body'
            target_scope: "all",
            // You can add specific user_id here if needed
            // user_id: "..." 
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${anonKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const status = response.status;
        const text = await response.text();

        console.log(`📡 Status Code: ${status}`);
        console.log(`📦 Response Body: ${text}`);

        if (status === 200) {
            console.log("✅ Function invocation SUCCESS!");
        } else {
            console.error("❌ Function invocation FAILED.");
        }

    } catch (error) {
        console.error("🔥 Network Error:", error);
    }
}

testPush();
