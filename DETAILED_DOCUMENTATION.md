This file includes
- Installation and setup guide
- Code architecture overview
- API documentation
- Usage examples & tutorials
- Contribution guidelines
- Testing & debugging instructions
- Deployment instructions (if applicable)
- Relevant snapshots from the provided PDF
- A strong argument on how combining static firewalls (ModSecurity/Naxsi) with Prism matches or exceeds commercial WAF solutions by leveraging session-based scoring and automated bot termination.


# Bayesian Traffic-Prism Documentation

**Bayesian Traffic-Prism** is an open-source, adaptive Web Application Firewall (WAF) enhancement that adds session intelligence, behavioral analysis, and Bayesian risk scoring on top of traditional firewalls. It works alongside static rule-based WAFs (like NAXSI or ModSecurity) and DDoS protection (FastNetMon) to provide advanced protection comparable to commercial WAF solutions ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=6,a%20fraction%20of%20the%20cost)) ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Rule%20based%20automatic%20termination,ModSecurity%20an%20opensource%20WAF%20and)). Traffic-Prism monitors entire user sessions (not just individual requests) in real-time, detects complex attack patterns (including DOM-based attacks), and can automatically terminate malicious sessions based on risk scores ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=2,and%20analyzes%20complete%20user%20journeys)) ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Platforms%20like%20ours%20monitor,to%20stop%20threats%20before%20escalation)). This documentation provides a comprehensive guide to installing, using, and contributing to Bayesian Traffic-Prism.

## Installation and Setup Guide

Traffic-Prism can be set up quickly using Docker or installed manually on a server. Below are instructions for both approaches:

### Quick Docker Installation

For an easy start, use the pre-built Docker image with a demonstration setup:

1. **Pull the Docker image:**  
   ```bash
   docker pull bayesiancyber/structured-cyber:v1.0
   ``` 

2. **Run the container:** Expose the necessary ports and run in detached mode:  
   ```bash
   docker run -d -p 3000:3000 -p 8124:8123 -p 9001:9000 -p 8001:8000 bayesiancyber/structured-cyber:v1.0
   ``` 
   This maps: 
   - Port 3000 (web UI) to localhost:3000, 
   - Port 8123 (ClickHouse HTTP interface) to localhost:8124, 
   - Port 9000 (ClickHouse native port) to localhost:9001, 
   - Port 8000 (Tracking/API server) to localhost:8001 ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=Quick%20Docker%20based%20installation%3A)).

3. **Access the interface:** Open a browser to `http://localhost:3000` (or `http://<server-ip>:3000` if running remotely). You should see the Traffic-Prism dashboard. Use the demo credentials `username: bluebot` and `password: bluebot123` to log in ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=structured,do%20reverse%20proxy%20from%20443)).

4. **Review the demo data:** The Docker image comes with dummy tracking data and default rules for you to explore the features ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=1.%20docker%20pull%20bayesiancyber%2Fstructured,do%20reverse%20proxy%20from%20443)). This allows you to familiarize yourself with the dashboard (session analytics, bot detection, etc.) before deploying on a production site.

> **Note:** The Docker setup is primarily for evaluation. For production use, a manual installation on a cloud instance with your own domain and SSL is recommended.

### Manual Installation

Follow these steps to set up Traffic-Prism on your own server:

1. **Provision a server:** Create a new Linux cloud instance (or VM). Set up a DNS **CNAME** for a subdomain (e.g. `metrics.yourdomain.com`) pointing to this server ([Bayesian-Traffic-Prism/Installation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Installation.md#:~:text=1,com)). This subdomain will host the Traffic-Prism dashboard and tracking endpoint.

2. **Set up reverse proxy (HTTPS):** Install Nginx (or any web server) and configure it to forward HTTPS traffic on port 443 to Traffic-Prism’s port (default 8000) on the same server ([Bayesian-Traffic-Prism/Installation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Installation.md#:~:text=1,com)). This will allow your tracking script to send data securely. Obtain a TLS certificate (e.g. via Let’s Encrypt) for `metrics.yourdomain.com`. After this step, `https://metrics.yourdomain.com` should proxy to the Traffic-Prism app.

3. **Install ClickHouse:** Traffic-Prism uses ClickHouse (a high-performance OLAP database) for storing and querying traffic data ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=3.%20Real,rules%20to%20detect%20malicious%20activity)). Install the ClickHouse server on the instance (using official packages) and ensure it’s running (listening on default port 9000 for native connections and 8123 for HTTP). 

4. **Create database tables:** Using the provided schema script, create the necessary tables in ClickHouse. The file `Main_clickhouse_tables.txt` (in the repository) contains `CREATE TABLE` statements for all required tables ([Bayesian-Traffic-Prism/Main_clickhouse_tables.txt at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Main_clickhouse_tables.txt#:~:text=CREATE%20TABLE%20default)) ([Bayesian-Traffic-Prism/Main_clickhouse_tables.txt at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Main_clickhouse_tables.txt#:~:text=CREATE%20TABLE%20default)). You can copy-paste these into the ClickHouse client or use `clickhouse-client < Main_clickhouse_tables.txt` to execute them. Key tables include:
   - **`tracking10`** – stores incoming web events (page views, clicks) with fields like timestamp, URL, IP, session_id, etc. ([Bayesian-Traffic-Prism/Main_clickhouse_tables.txt at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Main_clickhouse_tables.txt#:~:text=CREATE%20TABLE%20default)) ([Bayesian-Traffic-Prism/Main_clickhouse_tables.txt at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Main_clickhouse_tables.txt#:~:text=)).
   - **`hist_session_risk_scores`** and **`updated_hist_session_risk_scores`** – store computed risk scores per session (before and after enrichment) ([Bayesian-Traffic-Prism/Main_clickhouse_tables.txt at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Main_clickhouse_tables.txt#:~:text=CREATE%20TABLE%20default)) ([Bayesian-Traffic-Prism/Main_clickhouse_tables.txt at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Main_clickhouse_tables.txt#:~:text=)).
   - **`users`** – holds login credentials for the Traffic-Prism UI ([Bayesian-Traffic-Prism/Main_clickhouse_tables.txt at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Main_clickhouse_tables.txt#:~:text=CREATE%20TABLE%20default)).
   - **`rules`** – stores custom security rules for automated actions ([Bayesian-Traffic-Prism/Main_clickhouse_tables.txt at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Main_clickhouse_tables.txt#:~:text=CREATE%20TABLE%20default)).
   - (Refer to the schema file for all tables and their columns.)

5. **Configure tracking script:** Edit the `basic-tracking.js` file to point to your instance. Replace `<<IP>>:8000` with your `metrics.yourdomain.com` domain (and port if needed) in the script’s XHR URL ([Bayesian-Traffic-Prism/basic-tracking.js at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/basic-tracking.js#:~:text=var%20xhr%20%3D%20new%20XMLHttpRequest)). This ensures the browser will send tracking data to your server. 

6. **Embed the tracking script:** Include the contents of `basic-tracking.js` on **every page** of your website, ideally just before the closing `</head>` tag inside a `<script>` element ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=CNAME%20to%20the%20cloud%20IP,as%20there%20is%20performance%20penalty)). This “pixel” script will capture client-side data and send it to Traffic-Prism (see **Usage** for details). If your website uses a tag manager, you can inject it via that as well.

7. **Clone and run the app:** Install Node.js (version 14+). Clone the `Bayesian-Traffic-Prism` repository on the server and install its dependencies:
   ```bash
   git clone https://github.com/RahulModak74/Bayesian-Traffic-Prism.git
   cd Bayesian-Traffic-Prism
   npm install
   ```
   Then start the application (using a process manager like **pm2** for reliability is recommended):
   ```bash
   node app.js
   ```
   The app will start an Express server (by default on port 8000) and connect to ClickHouse. You should see a log confirming the server is running. (Ensure firewall rules allow the necessary ports.)

8. **Initialize configuration:** By default, Traffic-Prism expects ClickHouse on `localhost:9000` with no authentication. If your setup differs, update the config (`config/clickhouse.js`) with the correct host/port/credentials. Also, create a default admin user in the `users` table (or via an SQL insert) so you can log in. For example:
   ```sql
   INSERT INTO default.users (username, passwordHash, hostname, version)
   VALUES ('admin', '<bcrypt-hash-of-password>', 'metrics.yourdomain.com', 1);
   ```
   (The `passwordHash` is a bcrypt hash; you can generate one using an online tool or Node script.)

9. **Verify tracking:** Visit your website (with the tracking script added) from a browser. Then navigate to `https://metrics.yourdomain.com` and log in to the Traffic-Prism dashboard. You should see your visit appear in the tracking data (e.g., in session lists or live traffic views). All page visits should be recorded in the `tracking10` table ([Bayesian-Traffic-Prism/Installation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Installation.md#:~:text=5,be%20tracked%20inside%20tracking10%20table)). If data isn’t appearing, check that the tracking script is correctly sending (browser console for network calls) and that CORS is allowed (the server may need to send `Access-Control-Allow-Origin` for your site’s domain).

10. **Historic risk data (optional):** For richer session analysis, you can periodically compute historical risk scores. Run the `historic_session_risk.js` script provided, adjusting the host and date range inside it. This generates a CSV (e.g., `enhanced_risk_data_<host>_<date>.csv`) with aggregated risk metrics per session. Load this into ClickHouse:
    ```bash
    clickhouse-client --query="INSERT INTO default.updated_hist_session_risk_scores FORMAT CSVWithNames" < enhanced_risk_data_...csv
    ``` 
    This will populate the `updated_hist_session_risk_scores` table ([Bayesian-Traffic-Prism/Installation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Installation.md#:~:text=8)), which the UI uses for an “enhanced” session risk view. (This step is optional for basic functionality but recommended for ongoing analysis.)

Once installed, the Traffic-Prism web interface will be available at your chosen subdomain (e.g. `metrics.yourdomain.com`). For a production deployment, ensure this subdomain is secured (using HTTPS and strong credentials) since it contains your security monitoring dashboard.

## Code Architecture Overview

**Traffic-Prism Architecture:** At a high level, Traffic-Prism introduces a feedback loop of data collection and analysis alongside a traditional WAF:

```
[Traditional WAF] → [Web Traffic] → [Traffic-Prism OLAP Layer] → [Behavioral Analytics]
                                   ↓
                        [Session Termination] ← [Risk Scoring] ← [ClickHouse Database]
```  
*Figure: Integration of Traffic-Prism into a web security stack ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=Architectural%20Diagram)).*

Key components of the system include:

- **Client-side Tracking Pixel:** The file `basic-tracking.js` is a lightweight JavaScript snippet that runs in users’ browsers. It generates a unique `sessionId` for each visitor and captures information on page loads, clicks, and environment:
  - Page URL and referrer.
  - Timestamp and optionally UTM parameters.
  - Browser user-agent, device/platform details (via a `getDeviceInfo()` function).
  - Custom events like button clicks (e.g. an “Add to Cart” button click, capturing its element details) ([Bayesian-Traffic-Prism/basic-tracking.js at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/basic-tracking.js#:~:text=document.addEventListener%28%27click%27%2C%20function%28event%29%20)) ([Bayesian-Traffic-Prism/basic-tracking.js at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/basic-tracking.js#:~:text=var%20clickData%20%3D%20)).
  - It listens for single-page app route changes (URL changes) and sends an event on each change ([Bayesian-Traffic-Prism/basic-tracking.js at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/basic-tracking.js#:~:text=%2F%2F%20URL%20change%20detection)) ([Bayesian-Traffic-Prism/basic-tracking.js at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/basic-tracking.js#:~:text=lastUrl%20%3D%20currentUrl%3B)).
  - **Data transmission:** Collected data is sent via an AJAX POST request to the Traffic-Prism server’s `/track` endpoint as JSON ([Bayesian-Traffic-Prism/basic-tracking.js at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/basic-tracking.js#:~:text=function%20sendData%28data%29%20)). The pixel operates as a “two-way” agent – it not only sends data, but is also designed to receive instructions (like a kill signal) if the server responds with one (see **Session Termination** below).

- **Server Application (Node.js):** The core of Traffic-Prism is a Node/Express application (`app.js`) that processes incoming data and provides a web UI. Major responsibilities of the server:
  - **Ingesting Tracking Data:** The `/track` route (see **API** below) accepts JSON from the pixel and inserts it into the `tracking10` table in ClickHouse. This is the raw event data for each session.
  - **Session Management:** Traffic-Prism correlates events by `sessionId` to build a picture of each user’s session (sequence of requests). The data is stored in an OLAP database (ClickHouse) to enable fast analytical queries across large numbers of events ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=3.%20Real,rules%20to%20detect%20malicious%20activity)). For example, a materialized view (`live_sessions_mv`) may aggregate the latest activity per session for quick access to active sessions.
  - **Risk Scoring Engine:** The server computes risk scores based on aggregated session behavior. This includes detecting patterns such as:
    - High request frequency (e.g., >5 URLs per second from one session) ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=behavioral%20rules%20to%20detect%20malicious,activity)).
    - Multiple rapid requests (e.g., 25+ requests in a short time) from one client ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=behavioral%20rules%20to%20detect%20malicious,activity)).
    - Suspicious user-agents (headless browsers or known bots masquerading as real browsers).
    - Unusual geographic changes (IP location anomalies within a session).
    - Signs of DOM manipulation attacks (e.g., a page generating unexpected DOM events).
    These factors contribute to a composite **risk score** for each session, which is updated in real-time or via periodic batch jobs (using the historic risk script). Sessions are stored with their risk attributes in tables like `hist_session_risk_scores` and `updated_hist_session_risk_scores` for historical tracking.
  - **Web Dashboard & Analytics:** The Express app serves an administrative UI (rendered with EJS templates) for security analysts to monitor and act on threats. The code is organized into route modules (under `routes/`) and corresponding views:
    - **Dashboard & Session Views:** E.g., `session-summary`, `session-journey` routes to list sessions and drill into a single session’s timeline.
    - **Risk Analysis Views:** E.g., `risk-analysis` and `updated-session-risk-analysis` show risk scoring details (possibly including any AI-based analysis).
    - **Specific Threat Views:** There are routes for categories of threats, likely mapping to pages like “Suspicious User Agents”, “Suspicious Referrers”, “High Frequency” (rate-based attacks), “Potential Scraping” (web scraping bots), “Unusual Bot Activity”, etc. These pages query ClickHouse for sessions matching those conditions and present the findings.
    - **Bot Overview/Details:** The `bot-overview` and `bot-details` routes likely summarize automated bot activity caught by the system (for example, bots that simulate browsers via tools like Playwright/Selenium ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Bots%20mimic%20human%20behavior,%E2%80%A2%20Misses%20behavioral%20attack%20patterns))).
    - **Rules Management:** A route `rules` and page to define custom rules for automated actions (see below).
    - **Auth & Admin:** Authentication routes (`auth`) handle login using the `users` table, and `admin` routes might allow user management or system settings.
  - **Integration Hooks (AI and Others):** The server is designed to incorporate advanced analysis:
    - A placeholder for GenAI/LLM integration exists (e.g., a route `genai` and mention of `risk-analysis.ejs` hooking into external ML models ([Bayesian-Traffic-Prism/ at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism?files=1#:~:text=Gen%20AI%20and%20LLM%20provide,effective%20against%20zero%20day%20vulnerabilities))). This allows using a machine learning model to score sessions for anomalies not caught by static rules (optional and off by default, as it may require custom model training ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=Bayesian%20Risk%20Inference%20%28Optional,day%20attacks%20and%20sophisticated%20threats)) ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=Gen%20AI%20and%20LLM%20provide,effective%20against%20zero%20day%20vulnerabilities))).
    - Static WAF Integration: While the Traffic-Prism server itself doesn’t modify WAF rules, it can export insights. For instance, it could log certain patterns that administrators can turn into ModSecurity/NAXSI rules. (Future versions may automate this by pushing to ModSecurity configs or APIs.)

- **ClickHouse OLAP Database:** All event and analytical data is stored in ClickHouse, which is chosen for its speed in aggregating large volumes of data. The schema (see `Main_clickhouse_tables.txt`) is structured for both **real-time analytics** (e.g., scanning recent events for threats) and **historical analysis** (storing risk trends over time). Because data is stored persistently, Traffic-Prism enables thorough incident investigation and forensic analysis of attacks after they occur ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=%2A%20Detects%20DOM,Prism)). For example, even if an XSS attack bypassed the front-end WAF, all the session’s behavior (DOM events, requests) would be recorded for review. Key points:
  - Data is partitioned and indexed by session or time where appropriate to optimize queries (e.g., the `live_sessions_mv` is partitioned by month and TTL is set to expire old sessions after a period) ([Bayesian-Traffic-Prism/Main_clickhouse_tables.txt at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Main_clickhouse_tables.txt#:~:text=PARTITION%20BY%20toYYYYMM)).
  - The `action_logs` table keeps a record of any automated actions taken (like terminating a session), including timestamp and session identifiers ([Bayesian-Traffic-Prism/Main_clickhouse_tables.txt at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Main_clickhouse_tables.txt#:~:text=CREATE%20TABLE%20default)).
  - The design ensures **complete attack chain visibility** – you can reconstruct the sequence from initial suspicious activity to final outcome for each session ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=%2A%20Detects%20DOM,Prism)).

- **Session Termination & Response Actions:** A standout feature of Traffic-Prism is its ability to respond to threats within an active session:
  - If a session’s risk score exceeds a defined threshold or matches a rule, Traffic-Prism can **automatically terminate that session** in near real-time ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=,that%20traditional%20WAFs%20cannot%20address)) ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Once%20the%20session%20is,sessions%20reducing%20the%20possible%20impact)). “Termination” can mean different actions:
    - Telling the tracking pixel to disable further user interaction or log the user out. (For example, the server could respond to the pixel’s next data POST with a directive to redirect the browser to a logout or block page. In the current version, the pixel script sends data but does not yet listen for a response; however, the concept of a two-way pixel implies this capability ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=,that%20traditional%20WAFs%20cannot%20address)).)
    - Adding the session’s identifying details (e.g., session ID or user token, or the client IP) to a blocklist. If integrated with a WAF, this could translate into the WAF blocking that IP or cookie on subsequent requests.
    - Triggering a challenge (like showing a CAPTCHA or requiring re-authentication) instead of a silent drop. The PDF mentions the possibility of “Captcha/Nudge/Terminate” as progressive actions for risky sessions ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=Monitoring%20Intelligent%20Actions)) ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=Captcha%2FNudge%2F)).
  - **Rules Engine:** Security operators can define custom rules in the `rules` table or via the UI for automated responses. A rule might specify a condition (e.g., `total_risk_score > 80` and `browser_risk > 0.5`) and an action (`terminate` or `require_captcha`). The Traffic-Prism server evaluates these rules against session data. This allows tailoring the response policy to the organization’s needs. For example, one rule could automatically drop any session originating from a disallowed country if flagged by geo-risk, while another might just log and flag (but not drop) an admin’s own penetration testing.
  - **Speed:** Because the pixel sends data continuously and the analysis is done in-memory/OLAP, detection and response are fast. Traffic-Prism aims to terminate malicious automated sessions in under 300 ms from detection ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=,that%20traditional%20WAFs%20cannot%20address)), mitigating threats like bots or DOM-based attacks before they cause harm on the client side.

In summary, the architecture augments your existing security: the traditional WAF or server-side firewall handles known attack signatures and request-by-request rules, while Traffic-Prism operates in parallel, watching the *behavior* of each session across multiple requests and the client-side interactions. This combined approach addresses gaps that single-request inspection misses, providing **session-layer security intelligence** and automated countermeasures (like killing a suspicious session or guiding it to a safe halt) ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Bots%20mimic%20human%20behavior,%E2%80%A2%20Misses%20behavioral%20attack%20patterns)) ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=2,and%20analyzes%20complete%20user%20journeys)).

## API Documentation

Traffic-Prism’s primary “API” endpoints are those used for tracking and integration. Most user-facing functionality is through the web dashboard, but there are a couple of important programmatic interfaces:

- **Tracking Endpoint (`POST /track`):** This is the core endpoint that the browser pixel contacts. It accepts JSON payloads containing tracking data. Example request format:
  ```http
  POST /track  HTTP/1.1
  Host: metrics.yourdomain.com
  Content-Type: application/json

  {
    "timestamp": "2025-03-10T07:45:12.345Z",
    "url": "https://www.yoursite.com/products?page=2",
    "referrer": "https://www.yoursite.com/home",
    "utmParameters": {"utm_source":"google","utm_campaign":"spring_sale"},
    "deviceInfo": {"platform":"Win32","userAgent":"Mozilla/5.0 ..."},
    "hostname": "www.yoursite.com",
    "sessionId": "abc123-def456-...",
    "clickData": null
  }
  ```
  The tracking script will send a payload like the above on page load, and include a `clickData` object when a relevant click event occurs (see code in `basic-tracking.js`) ([Bayesian-Traffic-Prism/basic-tracking.js at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/basic-tracking.js#:~:text=var%20clickData%20%3D%20)). The server responds with a simple status (usually HTTP 200 on success). *(Note: Future enhancements may return instructions in the response, e.g., to prompt the client with a CAPTCHA or block message if the session is terminated.)*

  **Integration:** Developers embedding Traffic-Prism should include the provided JS snippet rather than calling this endpoint manually. However, if needed, you can send custom events to `/track` via XHR/fetch from your application (for example, to record a specific business event as part of the session data). Make sure to include the current `sessionId` (accessible as `window.trackingData.sessionId` after the pixel script runs ([Bayesian-Traffic-Prism/basic-tracking.js at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/basic-tracking.js#:~:text=%2F%2F%20Expose%20session%20ID%20for,other%20scripts))).

- **Login Endpoint (`POST /auth/login`):** The admin UI uses an auth route for logging into the dashboard. The default credentials can be set in the database (`users` table) as described. (This is not an open API for external use, just part of the web app.)

- **Rules Endpoint (`POST /rules` etc.):** If using the UI to add/edit rules, the app will have endpoints for managing rules. These likely expect JSON or form data describing the rule condition and action. (Refer to the code or future docs for the exact format; at this stage, rule management might also be done by directly manipulating the database or config files.)

- **GenAI Risk Scoring API (Optional):** In advanced setups, you can integrate an AI model for risk scoring. This would involve an API either to an external service or a local model. The Traffic-Prism repository leaves a placeholder in `risk-analysis.js` where custom logic or API calls can be inserted ([Bayesian-Traffic-Prism/ at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism?files=1#:~:text=Gen%20AI%20and%20LLM%20provide,effective%20against%20zero%20day%20vulnerabilities)). For example, you could call out to a Python service running a PyMC3 Bayesian model or a fine-tuned LLM that evaluates the session data and returns a risk score. This is not enabled by default; it requires custom implementation. (See **GenAI & LLM Integration** in the repository for guidance ([Bayesian-Traffic-Prism/GenAI-LLM.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/GenAI-LLM.md#:~:text=1.%20Ollama,their%20ability%20to%20work%20with)) ([Bayesian-Traffic-Prism/GenAI-LLM.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/GenAI-LLM.md#:~:text=For%20organizations%20requiring%20specialized%20GenAI,LLM%20implementations%20in%20Traffic%20Prism)).)

- **Data Export API:** Traffic-Prism does not currently expose a public REST API for retrieving data (besides what the web UI uses internally). However, since the data is in ClickHouse, you can query the ClickHouse HTTP interface (port 8123) to run SQL queries and extract data in formats like JSON or CSV. This can serve as an **integration point** with other systems (SIEMs, BI dashboards). Ensure you secure the ClickHouse endpoint or only expose it internally.

**CORS:** The `/track` endpoint should handle cross-origin requests, as your website (on your main domain) will be sending data to the metrics subdomain. Configure the server or reverse proxy to add `Access-Control-Allow-Origin: https://www.yoursite.com` (and allow the necessary methods/headers). This detail is important for the pixel to function. (Appendix C of the PDF highlights CORS header changes needed ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=APPENDIX%20C%3A%20Changes%20in%20CORS,Headers)).)

**Note:** All API calls should be made over HTTPS in production to protect the data in transit (the tracking data could include sensitive info like session identifiers, etc.). Also, consider enabling authentication on the tracking endpoint if you want to restrict which sites can send data (though typically it’s open for any client that has the script).

## Usage Examples & Tutorials

This section illustrates how to use Traffic-Prism in practice, from initial integration to detecting and mitigating an attack. 

### Example 1: Basic Integration and Monitoring

**Scenario:** You have an e-commerce website and want to monitor user sessions for suspicious behavior.

1. **Integrate the Pixel:** After following the setup guide, you have `basic-tracking.js` included on all pages of your site. Users browsing the site will trigger events that are sent to Traffic-Prism’s tracking endpoint. For instance, when a user navigates to a product page or clicks “Add to Cart,” an event is recorded with details of that action (URL, timestamp, element clicked, etc.) ([Bayesian-Traffic-Prism/basic-tracking.js at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/basic-tracking.js#:~:text=var%20clickData%20%3D%20)) ([Bayesian-Traffic-Prism/basic-tracking.js at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/basic-tracking.js#:~:text=%27innerHTML%27%3A%20targetElement)).

2. **View the Dashboard:** Log in to the Traffic-Prism dashboard at `metrics.yourdomain.com`. On the home or sessions overview page, you’ll see active sessions listed. Each session entry might show the number of requests, pages visited, current page, and a risk score. Initially, normal user sessions will have low risk scores.

3. **Session Drill-down:** Click on a session ID in the dashboard to view the **Session Journey** or details. You can see the sequence of URLs visited by that user, timestamps, and any alerts or flags (such as “Multiple IPs detected” if the user’s IP changed mid-session, or “High Frequency” if they made many requests quickly). This helps you understand user behavior and also verify that legitimate sessions are tracked correctly.

4. **Behavioral Analytics:** Explore pages like **Suspicious User Agents** or **Suspicious Referrers**. If nothing shows up initially, that’s good – it means no obvious issues. To test, you might try using a headless browser yourself (e.g., using a script with Headless Chrome) to browse the site, and see if that session appears under Suspicious User Agents (Traffic-Prism would flag the atypical user agent string and assign a higher browser risk) ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=behavioral%20rules%20to%20detect%20malicious,activity)).

5. **Live Alerts:** Traffic-Prism can highlight anomalies in real-time. For example, if you quickly refresh a page 10 times in a few seconds, the system’s high-frequency detection rule will flag your session. In the dashboard, your session’s risk score will spike (due to the frequency component) and it might move to a “High Frequency” incidents list. If an auto-termination rule is set for that condition, your session could be marked for termination (in a real attack scenario).

### Example 2: Detecting a Bot Attack

**Scenario:** A scraping bot is attempting to crawl your site rapidly, trying to steal content. The bot is using a headless browser that mimics a real user but its behavior is abnormal.

1. **Bot Activity on the Site:** The bot hits dozens of pages per minute. It has a valid session id (since the pixel runs even in headless Chrome, assuming JavaScript is enabled by the bot) and all events are being sent to Traffic-Prism.

2. **Traffic-Prism Detection:** Several rules/heuristics in Traffic-Prism will catch this:
   - **High Request Rate:** The session triggers the rule of >5 URLs per second ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=behavioral%20rules%20to%20detect%20malicious,activity)). Traffic-Prism logs this under “Potential Scraping” or “High Frequency” alerts.
   - **Behavioral Pattern:** Unlike a human, the bot might not spend time on each page (no significant gap between page events), might not trigger any click events (just page loads), and could be accessing pages in a sequential or repetitive pattern. These subtle indicators can be seen in the session journey.
   - **Bot Fingerprinting:** If the bot’s browser automation isn’t perfect, the user agent or fingerprint data might betray it (e.g., missing certain typical properties). Traffic-Prism’s suspicious user-agent detection would increase the risk score ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Bots%20mimic%20human%20behavior,%E2%80%A2%20Misses%20behavioral%20attack%20patterns)).

3. **Alert in Dashboard:** In the dashboard’s **Bot Overview**, you see a new entry: Session ID `XYZ123` with very high risk. It might show “Bot Likely” with contributing factors (high freq, suspicious UA, no referrers, etc.). The risk score is, say, 90/100.

4. **Automated Response:** You have previously set a rule: if `total_risk_score > 80` and `freq_risk` is high, **terminate session**. Traffic-Prism thus adds that session to a termination list. The next time the pixel contacts the server (which could be immediately with the next event), the server responds in a way that stops the bot. For instance, it might send a special response causing the pixel script to redirect the browser to a blank page or an error. In practice, the bot might interpret that as no more content and stop. If integrated with your WAF, you might also have a script that reads the `action_logs` from Traffic-Prism and adds the bot’s IP to a blocklist in Nginx/ModSecurity.

5. **Result:** The bot’s session is cut off automatically, without you manually intervening. In the case study from the PDF, a fashion brand using this approach **“blocked malicious bots” and protected their content from scraping ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Bot%20detection%20rules%20%E2%80%A2,designs%20%E2%80%A2%20Preserved%20IP%20assets)).** In your dashboard, you’ll see that the session status is “terminated by rule at [time]” in the logs.

6. **Post-incident Analysis:** Later, you can analyze that session in Traffic-Prism. All the bot’s requests are recorded. This helps in writing more static rules if needed (for example, if the bot targeted a specific URL pattern, you could add a WAF rule to disallow that pattern entirely). Traffic-Prism thus serves as an incident recorder. For the scraping attack, you might also see aggregate reports like how many pages were attempted before termination, which can be useful for reporting.

### Example 3: DOM-Based XSS Attack Attempt

**Scenario:** An attacker discovered a DOM XSS vulnerability in your single-page application. The malicious payload doesn’t get caught by server-side filters (because it executes entirely in the browser DOM).

1. **Attack Execution:** The attacker lures a user (or an automated script simulating a user) to trigger the XSS (maybe via a malicious URL or a stored value that gets read by a script on the page). The attack tries to manipulate the DOM or steal data from the page.

2. **Traffic-Prism Detection:** Traffic-Prism’s client-side pixel is in a unique position to catch this. Since it runs on every page, it could detect anomalies in the DOM or unusual sequences of events. For instance, if a script unexpectedly injects an `<iframe>` or alters the page in a way typical of XSS, the pixel (in an advanced configuration) could capture that as a suspicious event. (The current basic pixel monitors clicks and URL changes; an enhanced version, as mentioned in the README, could include DOM mutation observers to catch unauthorized changes – this is an area of ongoing development ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=pixel%20in%20header%20tag%20,as%20there%20is%20performance%20penalty)).)

3. **Alert and Response:** Traffic-Prism might not automatically stop a DOM XSS (as it’s happening inside the user’s session), but it **raises the session’s risk** significantly upon detecting the anomaly. If you have rules to terminate on any XSS indicator, the session can be terminated (which might, for example, close the connection or log the user out, mitigating how far the attack can go). Also, because Traffic-Prism logs such events, you’ll have a record that something suspicious happened in the DOM.

4. **Investigation:** In the dashboard, you see an alert under “DOM Attack Detected” (if such a module is enabled). The session risk is high, and the notes might show something like “Detected DOM-based XSS pattern – e.g., script injected into DOM.” You can then follow up by reviewing that page’s code or logs on the client side. **Traffic-Prism is providing a layer of visibility that normal WAFs don’t have – monitoring inside the browser** ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Modern%20websites%20are%20dynamic%2C,DOM%20XSS%2C%20clickjacking%2C%20etc)). This can be crucial for modern apps where many attacks don’t go through traditional requests.

5. **Hardening:** Armed with this knowledge, you can patch the vulnerability on your site. In the meantime, you could also add a temporary rule in Traffic-Prism to watch for that specific pattern and immediately terminate any session where it recurs. For example, if the XSS always redirects users to a certain rogue domain, you could have Traffic-Prism watch referrers or new URL loads for that domain and cut off the session.

### Using the Dashboard

Traffic-Prism’s web interface is designed for security analysts and administrators:
- **Navigation:** After login, you’ll find sections for **Sessions**, **Analysis**, and **Settings/Rules**. The Sessions section lists user sessions and may allow filtering by risk level or activity status (active vs completed). Analysis sections correspond to different threat categories (bot activity, XSS/CSRF, etc.) as described.
- **Charts and Analytics:** Some pages might show charts (e.g., a timeline of requests, or a breakdown of risk factors for a session). These help visualize the data captured.
- **Taking Action:** Through the UI, you can manually apply actions. For instance, you might select a suspicious session and choose to terminate it immediately (if it hasn’t auto-terminated). You can also define rules in a user-friendly way, such as “If a single session has >100 requests in  minute, then block that session.”
- **Reporting:** Traffic-Prism can be connected to reporting tools. The PDF mentioned real-time Power BI reporting for ModSecurity logs ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=scoring%20for%20attacks%20that%20WAFs,time%20Power%20BI)) – similarly, for Traffic-Prism data, you could use ClickHouse’s integration with Grafana or export data to BI tools for executive reports on how many attacks were blocked, etc.

By combining **hands-on monitoring** and **automated rules**, Traffic-Prism enables a proactive security posture. Over time, you can tune the system – for example, if you find false positives (legitimate users flagged), you can adjust thresholds or exclude certain user groups from specific rules.

## Contribution Guidelines

Traffic-Prism is an open-source, community-driven project – contributions are welcome! If you are a developer, researcher, or cybersecurity professional interested in improving this tool, here’s how you can contribute:

- **Report Bugs:** If you encounter any issues or security bugs, please open a GitHub issue detailing the problem ([Bayesian-Traffic-Prism/ at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism?files=1#:~:text=Report%20Bugs%3A%20Open%20an%20issue,if%20you%20encounter%20any%20problems)). Include steps to reproduce and any relevant log output or data. This helps us improve stability and security.

- **Submit Features:** For code contributions, fork the repository on GitHub, implement your changes or new features, and then submit a Pull Request ([Bayesian-Traffic-Prism/ at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism?files=1#:~:text=Report%20Bugs%3A%20Open%20an%20issue,if%20you%20encounter%20any%20problems)). Make sure to describe the feature and the rationale in the PR. Some feature ideas could be new detection modules, performance improvements, UI enhancements, etc.

- **Coding Standards:** Please follow the existing coding style (the project is primarily JavaScript/Node – use consistent formatting, add comments where necessary). Ensure **your code adheres to our coding standards and passes existing tests** ([Bayesian-Traffic-Prism/ at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism?files=1#:~:text=Contribution%20Guidelines%3A)). If you introduce a new module, add corresponding unit tests or integration tests.

- **Include Tests:** If you fix a bug or add a feature, try to include automated tests that verify the behavior ([Bayesian-Traffic-Prism/ at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism?files=1#:~:text=Ensure%20your%20code%20adheres%20to,our%20coding%20standards)). This could mean adding sample input data and expected output in a test file. (The repository may set up a testing framework; if not, at least provide a manual test procedure.)

- **Improve Documentation:** We welcome improvements to documentation. If you find parts of this doc unclear, or if new features need documentation, feel free to update the markdown files and submit a PR ([Bayesian-Traffic-Prism/ at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism?files=1#:~:text=Professional%20Consulting%3A%20To%20develop%20custom,in)). Good documentation is as valuable as code!

- **Follow the Code of Conduct:** Be respectful and constructive in communications. We aim to maintain a friendly community for collaboration.

- **Community Support:** You can also help others by answering questions in GitHub Discussions or (in the future) on our Discord channel ([Bayesian-Traffic-Prism/ at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism?files=1#:~:text=Website%3A%20Visit%20us%20at%20bayesiananalytics,for%20more%20information)). Sharing how you use Traffic-Prism or how you solved a problem can benefit everyone.

When contributing, keep in mind that Traffic-Prism is intended to be an **“open-source, transparent, and neutral” cybersecurity tool ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=Vision%20At%20Bayesian%20Traffic,session%20hijacking%2C%20and%20bot%20attacks)).** Any contribution should align with this ethos – for example, avoid adding proprietary dependencies that hinder openness.

**Development Setup:** For contributors setting up a dev environment:
- Use a recent Node.js version and install ClickHouse locally (you can use Docker for ClickHouse if preferred).
- It’s helpful to have some sample data in ClickHouse. You can simulate traffic by browsing a test site with the pixel or writing a script to insert dummy data.
- Run the app with `npm start` and navigate the UI. You might create a few fake users/sessions to see how the UI behaves, so you know your changes don’t break things.
- If working on the front-end (EJS templates or client JS), note that the styling and layout should remain functional; test changes in multiple browsers if possible.

We appreciate all forms of contribution, from core code enhancements to writing tutorials and documenting real-world use cases. By contributing, you are helping to democratize web security and move closer to the vision of making **enterprise-grade cybersecurity freely accessible to all ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=Vision%20At%20Bayesian%20Traffic,session%20hijacking%2C%20and%20bot%20attacks))**.

## Testing & Debugging Instructions

Setting up a security platform can be complex. Here are tips for testing your Traffic-Prism deployment and debugging common issues:

**Initial Smoke Test:** After installation, perform a quick smoke test:
- Open your website in a browser with developer tools (console/network tab). Verify that the tracking script is loaded and that a POST request to `/track` is succeeding (HTTP 200). If it fails, check the browser console for CORS errors or network errors.
- Log into the Traffic-Prism UI and confirm that the login works and you can see the dashboard. Check the ClickHouse connection by navigating the UI pages – if some pages fail to load data, the server might not be querying the DB correctly (look at the server logs for database errors).

**Common Issues & Debugging:**

- **No data in ClickHouse:** If the UI is empty and you see no data in the `tracking10` table:
  - Ensure the pixel is sending to the correct URL. The URL in the script must match exactly your server’s domain and port (including http/https). If you see `net::ERR_CONNECTION_REFUSED` or similar in the browser console, the request isn’t hitting the server – check firewall and URL.
  - Check the server log output. The Express app might log an error if it fails to insert into ClickHouse. For example, a misconfigured ClickHouse connection (wrong host/port) could cause insert failures. The `config/clickhouse.js` should point to your ClickHouse instance. By default it uses `localhost` – if your DB is elsewhere, update it.
  - Try inserting a test row manually into `tracking10` via clickhouse-client and see if the UI can display it (to isolate if it’s an insertion issue or a retrieval issue).

- **CORS errors:** If the browser refuses to POST to `/track` due to cross-origin restrictions, you’ll need to enable CORS. In a simple fix, you can install the `cors` npm package and use `app.use(cors())` in `app.js` (configured to allow your site’s origin). Or configure Nginx to add the header. Appendix C hints at necessary CORS header changes ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=APPENDIX%20C%3A%20Changes%20in%20CORS,Headers)). This is critical when `metrics.yourdomain.com` is different from your main site domain.

- **Session ID collisions or resets:** The tracking script uses `localStorage` (likely) to persist a sessionId. If you notice new sessionIds on every page load for the same user, it could be that `localStorage` is blocked or the script isn’t storing it correctly. Check that the browser allows local storage (some privacy modes don’t). Also, ensure the script is not included in a way that resets its state frequently. If needed, you can modify the pixel to, for example, tie session to your site’s login session (like use a server-side session token).

- **Performance issues:** ClickHouse is fast, but if you feed extremely high volumes of events, ensure your server resources are sufficient. If the UI pages take too long to load, you might need to optimize:
  - Check if the `MergeTree` tables have proper indices for the queries being run. The provided schema has ordering keys; ensure they match how data is queried. For instance, risk lookups by session_id should be fast due to ORDER BY session_id on those tables ([Bayesian-Traffic-Prism/Main_clickhouse_tables.txt at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Main_clickhouse_tables.txt#:~:text=)) ([Bayesian-Traffic-Prism/Main_clickhouse_tables.txt at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Main_clickhouse_tables.txt#:~:text=)).
  - The `TTL last_activity + interval 5 minute` on `live_sessions_mv` ([Bayesian-Traffic-Prism/Main_clickhouse_tables.txt at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Main_clickhouse_tables.txt#:~:text=PARTITION%20BY%20toYYYYMM)) indicates that completed sessions will drop off after 5 minutes of inactivity, to keep “live” data lightweight.
  - If needed, you can adjust retention (e.g., keep data for longer or shorter) by modifying table TTLs or archiving old data to another system.

- **Debugging risk calculations:** If the risk scores or flags don’t seem to match expected behavior, you might want to test the logic:
  - Look at the code in routes like `high-frequency.js`, `suspicious-user-agents.js`, etc. These likely contain the thresholds and query logic (e.g., “select sessions with >X requests in Y seconds”). You can run those queries manually in ClickHouse to see if they return the sessions you expect.
  - The `historic_session_risk.js` script can be run with a small date range (or even modified to run for just the last hour) to recompute scores and see if that updates the `updated_hist_session_risk_scores` table correctly.
  - Enable verbose logging if available. You might temporarily add `console.log` statements in the server code for critical functions (like after receiving tracking data, or when applying rules) to trace the flow.

- **Catching errors:** The app uses Express and should catch errors globally (`app.use((err, req, res, next) => { ... }` in `app.js` handles errors) ([Bayesian-Traffic-Prism/app.js at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/app.js#:~:text=app.use%28%28err%2C%20req%2C%20res%2C%20next%29%20%3D,)). Check the server console for any stack traces. If something like the GenAI integration is misconfigured, it might throw errors – ensure any optional components are disabled or properly handled.

- **Crumbling UI or missing assets:** If the UI isn’t rendering properly, ensure static files are being served. The app likely uses `express.static` to serve JS/CSS from a `public` folder ([Bayesian-Traffic-Prism/app.js at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/app.js#:~:text=match%20at%20L589%20app)). Verify that the static content is in place. Also, some UI elements might rely on libraries (maybe included via CDN or local files). An internet-restricted server might not load CDN files; you might need to host them locally.

**Running Tests:** At present, the repository does not include a test suite, but you can test functionality manually:
- Create a variety of simulated sessions:
  - One normal browsing session.
  - One that triggers a known rule (e.g., use a script to hit 10 pages/second).
  - One with an unusual user agent (you can change your browser UA string or use curl with the pixel calls).
- Verify that each of these appears in the appropriate section of the dashboard and that any automated actions (if configured) occur.

For debugging in development, consider using Node.js debugger or logging and using a small dataset. Because ClickHouse is the back-end, you can directly inspect the DB state to verify what the Node app is doing.

Finally, if you run into an issue you can’t resolve, feel free to reach out via the GitHub Discussions or issue tracker. The community or maintainers might have encountered the same and can assist ([Bayesian-Traffic-Prism/ at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism?files=1#:~:text=Website%3A%20Visit%20us%20at%20bayesiananalytics,for%20more%20information)). Remember that Traffic-Prism is a relatively new project, and your feedback will help improve it.

## Deployment Instructions

Deploying Bayesian Traffic-Prism in a production environment involves configuring it to run continuously and integrating it with your overall infrastructure. Here are guidelines for a robust deployment:

- **Production Server Setup:** Choose a reliable server or VM (Linux based) to host Traffic-Prism. Ensure it has sufficient CPU and memory, as both Node.js and ClickHouse will consume resources (ClickHouse especially benefits from good I/O and plenty of RAM for caching). For high traffic sites, consider using a dedicated machine for ClickHouse or using a ClickHouse cluster, while the Node app can run on a separate machine.

- **Process Management:** Use a process manager to keep the Node.js app running. Examples: **pm2**, **systemd**, or **docker container** in a orchestrator. For instance, with pm2:
  ```bash
  pm2 start app.js --name "traffic-prism"
  pm2 save
  ```
  This will auto-restart the app on crashes or system reboots. Monitor the logs via pm2 or redirect logs to a file for later analysis.

- **Domain and SSL:** As covered in installation, run Traffic-Prism behind an Nginx reverse proxy for SSL termination. This also allows you to configure additional security (like basic auth or IP allow-listing if you want only certain IPs to access the dashboard).
  - Use a subdomain like `metrics.yourdomain.com` for clarity.
  - Obtain an SSL certificate and keep it renewed (Let’s Encrypt can automate renewal).
  - Enforce HTTPS and maybe set up a firewall so that the Traffic-Prism app port (8000) is not directly accessible from the internet – only via Nginx. This prevents someone bypassing your domain and hitting the HTTP endpoint without SSL.

- **WAF Integration:** Since Traffic-Prism is designed to **complement a WAF, not replace it**, ensure you have a WAF or equivalent in place in front of your web application:
  - If you use Nginx with ModSecurity or NAXSI, configure those modules on your main web server (which hosts your site, not the Traffic-Prism server). They will filter incoming traffic and block obvious attacks at the request level.
  - Traffic-Prism’s pixel is not affected by these, as it runs after pages are delivered. However, if a request is blocked by the WAF, it might reduce the data Traffic-Prism sees (which is fine – we prefer the attack never reaches the page). 
  - **Collaborative Defense:** Use insights from Traffic-Prism to update WAF rules. For example, if Traffic-Prism consistently flags certain URL parameters or patterns as malicious (zero-day attacks that WAF didn’t catch), you can add a new ModSecurity rule for those patterns, thereby strengthening the static WAF. Traffic-Prism essentially provides an **open-source benchmark of advanced detection** that you can use to improve your rule-based defenses ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=7.%20Benchmark%20for%20Evaluation%3A%20Traffic,you%20ultimately%20choose%20commercial%20options)).

- **DDoS Protection:** Deploy FastNetMon or any DDoS mitigation on the network level if you expect large scale attacks ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Rule%20based%20automatic%20termination,ModSecurity%20an%20opensource%20WAF%20and)). Traffic-Prism will not handle pure volumetric DDoS (that’s outside its scope), but it can identify layer7 (application layer) floods. If you integrate with FastNetMon, you could potentially feed it triggers (e.g., if Traffic-Prism flags a session for making 1000 requests, and those are still coming, FastNetMon can block the source IP at the network level). Coordinating these systems provides comprehensive coverage.

- **Scaling Considerations:** If your site has very high traffic (millions of events), monitor ClickHouse performance. ClickHouse can handle a lot, but you may need to:
  - Use a multi-node ClickHouse cluster or tune retention (maybe you don’t need to keep all events indefinitely – archive older data).
  - Shard data by host if you protect multiple websites with one Traffic-Prism deployment (the `host` field in tables can be used to separate data per site).
  - Run multiple instances of the Node app if needed for load balancing the dashboard, though typically one should handle quite a lot since most heavy work is offloaded to the DB.

- **Backups and Data Management:** The security logs and data in Traffic-Prism can be valuable (for compliance or audits). Set up regular backups for the ClickHouse data directory or use ClickHouse’s backup tools to snapshot the database. Keep in mind privacy and compliance – the data might include IP addresses and possibly user identifiers (depending on what you capture), so handle it in accordance with GDPR or relevant regulations (Traffic-Prism keeps data in your infrastructure, aiding compliance ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=Data%20Sovereignty%20%26%20Compliance))).

- **Updates:** Stay updated with the repository for new releases. Since Traffic-Prism is evolving, you might get new detection modules, bug fixes, and performance improvements. When updating:
  - Test new versions in a staging environment (especially if you modified or extended anything).
  - Run database migrations if any (check the repository notes for changes to the ClickHouse schema between versions).
  - Ensure your custom rules or integration code still works after updating.

- **Monitoring the Monitor:** Use system monitoring for the Traffic-Prism server itself. Ensure you have alerts if:
  - The Node.js process crashes or is using abnormally high CPU/memory.
  - ClickHouse service goes down or slows (it could cause Traffic-Prism to malfunction).
  - The disk fills up (ClickHouse could consume disk as it logs data; implement retention policies and monitor disk usage).

- **Deployment for Hosted Websites:** If you are using Traffic-Prism on a hosted website (e.g., a WordPress blog on shared hosting where you can’t install a WAF), you can still deploy Traffic-Prism on a separate server. You’d then include the pixel on your blog. Traffic-Prism will act as a **remote monitor** for your site’s sessions and attacks. While it can’t block at the server (since you don’t control the host’s server), it can still alert you to attacks and potentially mitigate client-side (e.g., prompt users with a warning if something is off). This use case was noted as **“Traffic-Prism only (hosted websites)” architecture in the PDF ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=TRAFFIC))**, highlighting that even without a WAF, it adds a layer of defense.

In deployment, the combination of systems is key: **Traffic-Prism + WAF + DDoS protection**. Together they form a defense-in-depth:
- The static WAF handles known exploits with zero latency (rules are instant allow/deny) but may miss evolving threats.
- Traffic-Prism adds **behavioral and session-based analysis**, catching things that slip through and providing the logic to react within the session ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Bots%20mimic%20human%20behavior,%E2%80%A2%20Misses%20behavioral%20attack%20patterns)) ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=2,and%20analyzes%20complete%20user%20journeys)).
- Network/DDoS tools protect the infrastructure from being overwhelmed by volume.

This layered approach, with Traffic-Prism bridging the intelligence gap, achieves a level of security on par with, or even exceeding, some commercial WAF offerings – at a fraction of the cost ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=6,a%20fraction%20of%20the%20cost)).

## Traffic-Prism vs. Commercial WAFs: Static Firewall + Prism Advantage

One of the core motivations behind Traffic-Prism is to **bring capabilities of enterprise commercial WAFs to the open-source stack** by combining traditional firewalls with advanced analytics ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Rule%20based%20automatic%20termination,ModSecurity%20an%20opensource%20WAF%20and)). Here we justify how a setup with a static WAF (ModSecurity/NAXSI) plus Traffic-Prism can match or exceed the protection of proprietary WAF solutions:

- **Session-Based Intelligence (Beyond Request Inspection):** Traditional WAFs (including most commercial ones) largely make decisions on a per-request basis – they see a request, compare it to rules (or learned models), and allow or block ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Risk%20score%20based%20rule,%E2%80%A2%20Misses%20behavioral%20attack%20patterns)). They don’t easily track state across a sequence of requests due to stateless HTTP nature. Traffic-Prism fills this gap by recording entire user sessions and applying analysis on the sequence as a whole ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=2,and%20analyzes%20complete%20user%20journeys)). This means it can detect **slow, multi-step attacks** that would appear benign when each step is viewed in isolation. For example, an attacker might probe with small inputs over many requests; each request alone doesn’t trigger a WAF rule, but collectively they form a reconnaissance pattern. Traffic-Prism would catch this via its session risk scoring, whereas many commercial WAFs might not, unless they have their own session tracking features (often only in very high-end products).

- **Behavioral Analytics and Anomaly Detection:** Commercial WAFs often rely on signature databases and some anomaly detection, but Traffic-Prism’s OLAP-powered approach provides more flexibility. It uses **behavioral rules** and optionally Bayesian inference/ML to identify anomalies ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=3.%20Real,rules%20to%20detect%20malicious%20activity)) ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=Bayesian%20Risk%20Inference%20%28Optional,day%20attacks%20and%20sophisticated%20threats)). This can detect threats that don’t match known signatures – for instance, a subtle web scraping bot that respects robots.txt and randomizes its traffic might evade signature-based detection, but its behavior (like consistent timing or navigation pattern) can still betray it, which Traffic-Prism can catch. The platform’s ability to store **historical patterns** and apply Bayesian risk inference means it can learn from past incidents to better flag new ones ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=Bayesian%20Risk%20Inference%20%28Optional,day%20attacks%20and%20sophisticated%20threats)). With the integration of GenAI or custom models, Traffic-Prism can even attempt zero-day attack detection, a feature typically touted by commercial next-gen WAFs ([Bayesian-Traffic-Prism/GenAI-LLM.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/GenAI-LLM.md#:~:text=GenAI%20and%20LLM%20technologies%20provide,risk%20environments)) ([Bayesian-Traffic-Prism/GenAI-LLM.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/GenAI-LLM.md#:~:text=For%20organizations%20requiring%20specialized%20GenAI,LLM%20implementations%20in%20Traffic%20Prism)).

- **Automated Bot Mitigation:** Many commercial WAFs now include “bot management” modules that detect bots and either block them or present CAPTCHAs. Traffic-Prism achieves the same by using its two-way pixel for **bot interaction and termination** ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=,that%20traditional%20WAFs%20cannot%20address)). When a session is deemed to be a bot (e.g., based on high frequency, no human-like pauses, or known headless browser signatures), Traffic-Prism can automatically terminate that session or challenge it. This is analogous to how advanced WAFs deal with bots (some inject JavaScript to test if it’s a real browser – Traffic-Prism’s JS is already in place to make that determination). In essence, Traffic-Prism turns the user’s browser into an ally that can **execute defensive measures** (like self-terminate the session) which a WAF alone can’t do once it has allowed the request through ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Bots%20mimic%20human%20behavior,%E2%80%A2%20Misses%20behavioral%20attack%20patterns)) ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Risk%20score%20based%20rule,%E2%80%A2%20Misses%20behavioral%20attack%20patterns)). By terminating bot sessions proactively, Traffic-Prism not only blocks current malicious actions but also discourages bots (since their connection drops, they may give up or slow down, similar to how commercial solutions “tarpit” bots).

- **Comprehensive Coverage with Open Components:** A combination of NAXSI/ModSecurity (for immediate request filtering), Traffic-Prism (for session analysis and client-side attack detection), and FastNetMon (for DDoS) provides **multi-layer coverage** ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Rule%20based%20automatic%20termination,ModSecurity%20an%20opensource%20WAF%20and)). This stack addresses:
  - Network floods (FastNetMon) – something outside the scope of most WAFs.
  - Common web exploits (ModSecurity/NAXSI rules) – similar to core rule sets in commercial WAFs.
  - Advanced threats and business logic attacks (Traffic-Prism) – often what commercial WAFs try to cover with machine learning and big-data analysis. Traffic-Prism brings an **OLAP big-data approach in-house** for the user ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=1.%20OLAP,layer%20to%20traditional%20security%20stacks)).
  
  According to the documentation, this trio can **“provide protection comparable to commercial WAFs at a fraction of the cost”** ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=6,a%20fraction%20of%20the%20cost)). The reason is that each component excels in its domain and they reinforce each other, whereas a standalone commercial WAF tries to do all in one (and often comes with high fees, and black-box algorithms).

- **Constant Rule Updates vs. Adaptive Learning:** Open-source WAFs rely on community rule updates (which ModSecurity has plenty of). Commercial vendors often tout their continuously updated threat intelligence. With Traffic-Prism, you gain the ability to dynamically update and create rules based on your environment’s actual traffic. It was mentioned that Traffic-Prism could even automate updates of static rules – for instance, if it detects a new attack vector, you could feed that back as a ModSecurity rule (possibly manually at this stage, but automation is conceivable). Thus, your open-source WAF is not static; it becomes **adaptive** with the help of Traffic-Prism’s insights.

- **Visibility and Forensics:** Because Traffic-Prism **stores all user journey data** ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=%2A%20Detects%20DOM,Prism)), you have complete visibility into what happened during an incident. Many commercial solutions are cloud-based and may give you only a summary or limited log access unless you pay more. With an open solution, you own the data. This aids in compliance (e.g., demonstrating to auditors how an attack was handled) and in fine-tuning your security. The data sovereignty is a big plus for organizations that prefer self-hosted solutions for privacy reasons ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=Data%20Sovereignty%20%26%20Compliance)).

- **Cost-Benefit:** The open-source stack significantly cuts costs while delivering similar results. Traffic-Prism itself is free (under SSPL license for internal use ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=License%20Traffic,SSPL%20license%20ensures%20that))), ModSecurity/NAXSI are free, and FastNetMon Community is free. Commercial WAFs can charge thousands of dollars monthly. Traffic-Prism serves as a **benchmark to evaluate WAF features** – you can see what it catches and then judge if a commercial product is offering anything beyond that ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=7.%20Benchmark%20for%20Evaluation%3A%20Traffic,you%20ultimately%20choose%20commercial%20options)). Often, you might find Traffic-Prism covers your needs, and you only need to invest in hardware or minor support, not in hefty licenses.

- **Example:** A case study from the PDF slides described a fintech company facing suspicious access from certain regions and high-risk sessions. By using session scoring and rule-based termination (Traffic-Prism’s approach), they **“blocked high-risk sessions” and reduced their attack surface, enhancing security posture ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=Solution%3A%20%E2%80%A2%20Session%20scoring%20%E2%80%A2,surface%20%E2%80%A2%20Enhanced%20security%20posture)).** This is a real-world validation that combining session intelligence with rules can thwart attacks effectively, presumably without a costly appliance in place.

- **Continuous Improvement via Community:** Commercial WAFs evolve behind closed doors. Traffic-Prism, being open-source, can rapidly integrate community contributions and cutting-edge techniques (for example, new detection for emerging attacks). Its design is extensible – e.g., you could plug in a new module for API security or IoT device traffic, which is mentioned in the roadmap ([Bayesian-Traffic-Prism/ at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism?files=1#:~:text=IoT%20Security%3A%20Extending%20our%20platform,IoT%20devices%20like%20smart%20meters)). In contrast, if a commercial WAF doesn’t support a niche use case, you’re stuck. Here, you have the freedom to extend.

In summary, **static firewalls + Traffic-Prism** combine deterministic protection with intelligent analysis. Static WAFs give you immediate blocks for known bad inputs, while Traffic-Prism looks at the bigger picture – **the context and behavior**, something attackers cannot easily disguise across an entire session ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Bots%20mimic%20human%20behavior,%E2%80%A2%20Misses%20behavioral%20attack%20patterns)). The session-based scoring means even if an attacker gets through the front gate (WAF), they are watched inside the application; any misstep raises their score until the system boots them out automatically. This layered, context-aware defense is what high-end commercial WAFs advertise – and now it’s achievable with open-source tools. Traffic-Prism essentially **upgrades 100,000+ ModSecurity installations to be on par with market-leading WAFs by adding bot detection, session intelligence, correlation, and automated incident response ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Upgrade%20for%20100%2C000%2B%20ModSecurity,as%20FastNetMon%20for%20DDoS%20detections)).**

By deploying Traffic-Prism alongside your existing firewalls, you leverage the best of both worlds: the rule-based precision of static WAFs and the adaptive, intelligent **“brain”** of Traffic-Prism that learns and reacts to threats in real-time. This not only matches what commercial WAFs do, but in some cases can exceed them, due to the tailored control and visibility you have over the system. And all of this is achieved without proprietary lock-in, staying true to the mission of making **enterprise-grade web security free and accessible to all ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=Vision%20At%20Bayesian%20Traffic,session%20hijacking%2C%20and%20bot%20attacks))**.

---

**References:**

1. Traffic-Prism Introduction and Vision ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=Vision%20At%20Bayesian%20Traffic,session%20hijacking%2C%20and%20bot%20attacks)) ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=What%20is%20Traffic,provides%20advanced%20features%20such%20as))  
2. Traffic-Prism Capabilities (DOM XSS, Session Intelligence, Bayesian risk) ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=DOM,XSS%2C%20DOM%20SQLi%2C%20and%20Clickjacking)) ([GitHub - RahulModak74/Bayesian-Traffic-Prism: AI + OLAP  powered WAF](https://github.com/RahulModak74/Bayesian-Traffic-Prism#:~:text=Gen%20AI%20and%20LLM%20provide,effective%20against%20zero%20day%20vulnerabilities))  
3. Core Innovations – OLAP and Behavioral Analysis ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=1.%20OLAP,layer%20to%20traditional%20security%20stacks)) ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=,Prism))  
4. Two-way Pixel and Session Termination ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=,that%20traditional%20WAFs%20cannot%20address)) ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Once%20the%20session%20is,sessions%20reducing%20the%20possible%20impact))  
5. Static WAF + Prism vs Commercial WAF ([Bayesian-Traffic-Prism/Innovation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Innovation.md#:~:text=6,a%20fraction%20of%20the%20cost)) ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Rule%20based%20automatic%20termination,ModSecurity%20an%20opensource%20WAF%20and))  
6. Advanced Threats vs WAF Limitations ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Bots%20mimic%20human%20behavior,%E2%80%A2%20Misses%20behavioral%20attack%20patterns)) (Session-level intelligence)  
7. Setup Instructions (GitHub README & Installation guide) ([Bayesian-Traffic-Prism/ at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism?files=1#:~:text=Quick%20Docker%20based%20installation%3A)) ([Bayesian-Traffic-Prism/Installation.md at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Installation.md#:~:text=4,js%20%28ideally%20with%20pm2))  
8. ClickHouse Schema (Tables for tracking and risk) ([Bayesian-Traffic-Prism/Main_clickhouse_tables.txt at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Main_clickhouse_tables.txt#:~:text=CREATE%20TABLE%20default)) ([Bayesian-Traffic-Prism/Main_clickhouse_tables.txt at main · RahulModak74/Bayesian-Traffic-Prism · GitHub](https://github.com/RahulModak74/Bayesian-Traffic-Prism/blob/main/Main_clickhouse_tables.txt#:~:text=))  
9. Case Studies (Fashion and Fintech outcomes) ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=%E2%80%A2%20Bot%20detection%20rules%20%E2%80%A2,designs%20%E2%80%A2%20Preserved%20IP%20assets)) ([Bayesian_Cybersecurity_V1.0.pdf](file://file-JotpWox7v3gAF8fzvVttfe#:~:text=Solution%3A%20%E2%80%A2%20Session%20scoring%20%E2%80%A2,surface%20%E2%80%A2%20Enhanced%20security%20posture))

