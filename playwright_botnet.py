import asyncio
import random
import time
from playwright.async_api import async_playwright
import argparse
import signal
import sys
from datetime import datetime
from faker import Faker

fake = Faker()

# Test configuration
target_url = "https://your-test-system.com"
active_sessions = 0
total_sessions = 0
stop_flag = False
start_time = None

# List of paths to randomly request
paths = ['/', '/about', '/products', '/contact', '/login', '/signup', 
         '/faq', '/support', '/pricing', '/terms', '/privacy']

async def simulate_playwright_session(context_id):
    """Simulate a sophisticated browser session using Playwright"""
    global active_sessions, total_sessions
    
    active_sessions += 1
    total_sessions += 1
    session_id = total_sessions
    
    try:
        async with async_playwright() as p:
            # Randomize browser type
            browser_type = random.choice([p.chromium, p.firefox, p.webkit])
            
            # Launch browser with random viewport and user agent
            browser = await browser_type.launch(headless=True)
            
            # Create context with specific parameters to look more human-like
            context = await browser.new_context(
                viewport={'width': random.randint(1024, 1920), 'height': random.randint(768, 1080)},
                user_agent=fake.user_agent(),
                locale=random.choice(['en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES']),
                color_scheme=random.choice(['light', 'dark']),
                java_script_enabled=True
            )
            
            # Add cookies to simulate returning user
            if random.random() > 0.7:
                await context.add_cookies([{
                    'name': 'session_id',
                    'value': f'test-session-{session_id}',
                    'domain': target_url.replace('https://', '').replace('http://', '').split('/')[0],
                    'path': '/'
                }])
            
            # Create a page
            page = await context.new_page()
            
            # Enable JavaScript execution
            await page.evaluate("() => { window.sessionId = '" + str(session_id) + "'; }")
            
            # Visit the homepage
            await page.goto(target_url)
            
            # Human-like interactions (vary from 3-8 actions)
            num_actions = random.randint(3, 8)
            for _ in range(num_actions):
                if stop_flag:
                    break
                    
                # Random delay between actions (more realistic timing)
                delay = random.uniform(1.0, 4.0)
                await asyncio.sleep(delay)
                
                action_type = random.random()
                
                if action_type < 0.4:  # 40% chance: navigate to a new page
                    path = random.choice(paths)
                    await page.goto(f"{target_url}{path}")
                
                elif action_type < 0.7:  # 30% chance: scroll the page
                    await page.evaluate("""
                        () => {
                            window.scrollTo({
                                top: Math.random() * document.body.scrollHeight * 0.7,
                                behavior: 'smooth'
                            });
                        }
                    """)
                
                elif action_type < 0.85:  # 15% chance: click a random link
                    try:
                        links = await page.query_selector_all('a')
                        if links and len(links) > 0:
                            link_idx = random.randint(0, len(links) - 1)
                            await links[link_idx].click(delay=random.uniform(0.1, 0.3))
                    except Exception as e:
                        print(f"Click error (expected in test): {e}")
                
                else:  # 15% chance: fill out a form if present
                    try:
                        # Look for form fields
                        inputs = await page.query_selector_all('input:not([type="hidden"])')
                        if inputs and len(inputs) > 0:
                            # Try to fill some inputs
                            for input_elem in inputs[:3]:  # Limit to first 3 inputs
                                input_type = await input_elem.get_attribute('type')
                                
                                if input_type == 'email':
                                    await input_elem.fill(fake.email())
                                elif input_type == 'password':
                                    await input_elem.fill(fake.password())
                                elif input_type in ['text', None]:
                                    await input_elem.fill(fake.name())
                                
                                # Slight delay between inputs
                                await asyncio.sleep(random.uniform(0.2, 1.0))
                            
                            # Sometimes submit the form
                            if random.random() > 0.5:
                                submit = await page.query_selector('button[type="submit"], input[type="submit"]')
                                if submit:
                                    await submit.click()
                    except Exception as e:
                        print(f"Form error (expected in test): {e}")
            
            # Close the browser
            await browser.close()
    
    except Exception as e:
        print(f"Session {session_id} error: {e}")
    
    finally:
        active_sessions -= 1

async def status_reporter():
    """Report status periodically"""
    global active_sessions, total_sessions, start_time
    
    while not stop_flag:
        elapsed = time.time() - start_time
        if elapsed > 0:
            rate = total_sessions / elapsed
            print(f"[{datetime.now().strftime('%H:%M:%S')}] "
                  f"Sessions: {total_sessions} | Rate: {rate:.2f} sessions/min | "
                  f"Active: {active_sessions}")
        await asyncio.sleep(2)

async def run_playwright_simulation(concurrent_sessions, duration):
    """Run multiple Playwright sessions concurrently"""
    global start_time, stop_flag, total_sessions
    
    print(f"Starting Playwright simulation with {concurrent_sessions} concurrent sessions")
    print(f"Target: {target_url}")
    print(f"Duration: {duration} seconds")
    print("=" * 50)
    
    # Reset counters
    start_time = time.time()
    total_sessions = 0
    stop_flag = False
    
    # Start status reporter
    reporter_task = asyncio.create_task(status_reporter())
    
    # Keep launching sessions to maintain the concurrent level
    tasks = []
    
    end_time = start_time + duration
    while time.time() < end_time and not stop_flag:
        # Launch more sessions if we're below our target concurrency
        while active_sessions < concurrent_sessions and not stop_flag:
            task = asyncio.create_task(simulate_playwright_session(len(tasks) + 1))
            tasks.append(task)
            # Small delay to stagger launches
            await asyncio.sleep(random.uniform(0.5, 2.0))
            
        # Wait a bit before checking again
        await asyncio.sleep(1)
    
    # Signal stop
    stop_flag = True
    
    # Final stats
    elapsed = time.time() - start_time
    if elapsed > 0:
        avg_rate = (total_sessions / elapsed) * 60  # sessions per minute
        print(f"\nTest completed.")
        print(f"Total browser sessions: {total_sessions}")
        print(f"Average rate: {avg_rate:.2f} sessions/minute")
        print(f"Duration: {elapsed:.2f} seconds")

def signal_handler(sig, frame):
    """Handle Ctrl+C to gracefully shutdown"""
    global stop_flag
    print("\nShutdown requested...")
    stop_flag = True

if __name__ == "__main__":
    # Register signal handler
    signal.signal(signal.SIGINT, signal_handler)
    
    parser = argparse.ArgumentParser(description='Playwright Bot Simulation Tool')
    parser.add_argument('--target', type=str, default=target_url, 
                      help='Target URL to test (use only with authorization)')
    parser.add_argument('--concurrent', type=int, default=10, 
                      help='Number of concurrent sessions to maintain')
    parser.add_argument('--duration', type=int, default=180, 
                      help='Test duration in seconds')
    
    args = parser.parse_args()
    
    target_url = args.target
    
    # Confirmation to ensure this is a legitimate test
    print("=" * 70)
    print("IMPORTANT: This tool is for legitimate security testing ONLY")
    print("You must have explicit permission to run this against any system")
    print("=" * 70)
    print(f"Target: {target_url}")
    print(f"Concurrent sessions: {args.concurrent}, Duration: {args.duration}s")
    
    confirm = input("Do you have authorization to test this system? (yes/no): ")
    if confirm.lower() != 'yes':
        print("Test aborted.")
        sys.exit(1)
    
    # Install requirements reminder
    print("\nNOTE: This script requires Playwright. If not installed, run:")
    print("pip install playwright")
    print("playwright install")
    
    # Run the simulation
    asyncio.run(run_playwright_simulation(args.concurrent, args.duration))
