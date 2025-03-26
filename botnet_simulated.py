import asyncio
import aiohttp
import random
import time
from faker import Faker
import argparse
import signal
import sys
from datetime import datetime

fake = Faker()

# Variables to track performance
start_time = None
request_count = 0
active_sessions = 0
stop_flag = False

# Target URL - ONLY use against authorized test systems
target_url = "https://your-test-system.com"

# List of paths to randomly request
paths = ['/', '/about', '/products', '/contact', '/login', '/signup', 
         '/faq', '/support', '/pricing', '/terms', '/privacy']

async def simulate_bot_session(session_id, rate_limiter):
    """Simulate a single bot session with multiple requests"""
    global request_count, active_sessions
    
    active_sessions += 1
    
    # Create randomized headers to appear more legitimate
    headers = {
        'User-Agent': fake.user_agent(),
        'Accept-Language': random.choice(['en-US,en', 'fr-FR,fr', 'de-DE,de', 'es-ES,es']),
        'Referer': random.choice([
            'https://www.google.com', 
            'https://www.bing.com',
            'https://www.facebook.com',
            'https://www.twitter.com',
            ''
        ]),
        'X-Session-ID': f"test-session-{session_id}"  # For tracking purposes
    }
    
    async with aiohttp.ClientSession(headers=headers) as session:
        # Each bot makes 5-15 requests
        num_requests = random.randint(5, 15)
        
        try:
            for i in range(num_requests):
                if stop_flag:
                    break
                    
                # Random path selection
                path = random.choice(paths)
                full_url = f"{target_url}{path}"
                
                # Wait for rate limiter
                async with rate_limiter:
                    try:
                        # GET request as default
                        if random.random() > 0.2:  # 80% GET, 20% POST
                            async with session.get(full_url) as response:
                                request_count += 1
                                # Optional: collect status codes for reporting
                        else:
                            # Simulate login/form submission
                            form_data = {
                                'username': fake.user_name(),
                                'password': fake.password(),
                                'email': fake.email()
                            }
                            async with session.post(f"{target_url}/login", data=form_data) as response:
                                request_count += 1
                                
                        # Simulate human-like delay between requests
                        # Much shorter than real humans to generate load
                        await asyncio.sleep(random.uniform(0.1, 0.5))
                        
                    except Exception as e:
                        print(f"Request error: {e}")
                        
        except Exception as e:
            print(f"Session error: {e}")
        
    active_sessions -= 1

async def status_reporter():
    """Report status periodically"""
    global request_count, start_time, active_sessions
    
    while not stop_flag:
        elapsed = time.time() - start_time
        if elapsed > 0:
            rate = request_count / elapsed
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Requests: {request_count} | "
                  f"Rate: {rate:.2f} req/sec | Active sessions: {active_sessions}")
        await asyncio.sleep(2)

async def run_botnet_simulation(target_rps, duration, ramp_up=10):
    """Run the botnet simulation with target requests per second"""
    global start_time, stop_flag, request_count
    
    print(f"Starting botnet simulation targeting {target_rps} requests/second for {duration} seconds")
    print(f"Target: {target_url}")
    print(f"Ramping up over {ramp_up} seconds")
    print("=" * 50)
    
    # Create rate limiter semaphore to control requests/second
    # We need a higher concurrency than our target RPS to account for network latency
    rate_limiter = asyncio.Semaphore(target_rps * 2)
    
    # Reset counters
    start_time = time.time()
    request_count = 0
    stop_flag = False
    
    # Start status reporter
    reporter_task = asyncio.create_task(status_reporter())
    
    # Launch bot sessions gradually to ramp up
    session_id = 0
    ramp_step = target_rps / ramp_up if ramp_up > 0 else target_rps
    
    tasks = []
    
    # Progressive ramp-up
    for i in range(1, ramp_up + 1):
        if stop_flag:
            break
            
        # Start a batch of sessions
        num_sessions = int(ramp_step)
        print(f"Launching {num_sessions} new bot sessions...")
        
        for _ in range(num_sessions):
            session_id += 1
            task = asyncio.create_task(simulate_bot_session(session_id, rate_limiter))
            tasks.append(task)
            
        # Small delay between batches during ramp-up
        await asyncio.sleep(1)
    
    # Wait for duration or until stopped
    try:
        await asyncio.sleep(duration - ramp_up)
    except asyncio.CancelledError:
        pass
    
    # Signal stop
    stop_flag = True
    
    # Allow some time for graceful shutdown
    print("\nShutdown initiated, waiting for sessions to complete...")
    await asyncio.sleep(2)
    
    # Cancel reporter
    reporter_task.cancel()
    
    # Final stats
    elapsed = time.time() - start_time
    if elapsed > 0:
        avg_rate = request_count / elapsed
        print(f"\nTest completed.")
        print(f"Total requests: {request_count}")
        print(f"Average rate: {avg_rate:.2f} requests/second")
        print(f"Duration: {elapsed:.2f} seconds")

def signal_handler(sig, frame):
    """Handle Ctrl+C to gracefully shutdown"""
    global stop_flag
    print("\nShutdown requested...")
    stop_flag = True

if __name__ == "__main__":
    # Register signal handler
    signal.signal(signal.SIGINT, signal_handler)
    
    parser = argparse.ArgumentParser(description='Botnet Simulation Tool for Testing')
    parser.add_argument('--target', type=str, default=target_url, 
                      help='Target URL to test (use only with authorization)')
    parser.add_argument('--rps', type=int, default=500, 
                      help='Target requests per second')
    parser.add_argument('--duration', type=int, default=60, 
                      help='Test duration in seconds')
    parser.add_argument('--ramp-up', type=int, default=10, 
                      help='Seconds to ramp up to full load')
    
    args = parser.parse_args()
    
    target_url = args.target
    
    # Confirmation to ensure this is a legitimate test
    print("=" * 70)
    print("IMPORTANT: This tool is for legitimate security testing ONLY")
    print("You must have explicit permission to run this against any system")
    print("=" * 70)
    print(f"Target: {target_url}")
    print(f"RPS: {args.rps}, Duration: {args.duration}s, Ramp-up: {args.ramp_up}s")
    
    confirm = input("Do you have authorization to test this system? (yes/no): ")
    if confirm.lower() != 'yes':
        print("Test aborted.")
        sys.exit(1)
    
    # Run the simulation
    asyncio.run(run_botnet_simulation(args.rps, args.duration, args.ramp_up))
