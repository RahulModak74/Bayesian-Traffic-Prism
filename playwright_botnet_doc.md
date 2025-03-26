Features of this Playwright-based simulation:
NOTE: Only use for testing websites for which you have official confirmation to conduct testing.
Advanced Browser Automation: Uses Playwright to generate sophisticated browser sessions that would bypass traditional detection
Human-like Behavior:

Realistic timing between actions (1-4 seconds)
Variable viewport sizes and user agents
Random scrolling behavior
Form interactions and link clicking
Multiple browser types (Chrome, Firefox, WebKit)


Session Variety: Different path navigation patterns, form interactions, and browsing behaviors
Concurrency Control: Maintains a specified number of concurrent sessions
Realistic Network Patterns: Each session makes multiple requests through realistic browser interactions

How this tests FastNetMon vs. Traffic-Prism:

FastNetMon is primarily designed to detect volumetric DDoS attacks by analyzing network traffic patterns
Traffic-Prism specializes in detecting sophisticated browser-level attacks and bots

This script creates legitimate-looking traffic that would likely bypass FastNetMon's detection since it:

Uses real browser sessions rather than raw packet floods
Has natural delays between requests
Generates traffic patterns that mimic human behavior
Creates a distributed pattern of requests

For Demonstration Purposes:

Run this script with a moderate level of concurrency (10-20 sessions)
Show how FastNetMon fails to identify this as malicious traffic
Then demonstrate how Traffic-Prism correctly identifies these sessions as automated/bot traffic

Note that this script generates fewer requests per second than the previous one but creates much more sophisticated traffic that better represents the types of attacks Traffic-Prism is designed to detect.
You can adjust the concurrent sessions parameter based on your testing system's capacity. Even 10-20 concurrent Playwright sessions can generate significant load, especially on smaller systems.
