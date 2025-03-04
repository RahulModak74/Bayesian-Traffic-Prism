Bayesian Traffic-Prism: Open-Source Web Security for All

Quick Docker based installation:

1. docker pull bayesiancyber/structured-cyber:v1.0
2. docker run -d -p 3000:3000 -p 8124:8123 -p 9001:9000 -p 8001:8000 structured-cyber
3. Go to localhost:3000 (or IP:3000 if you are installting on cloud IP)
4. THIS IF YOU DO ON YOUR WINDOW MACHINE, YOU WILL BE ABLE TO STUDY WORKING REPO WITH OUR DUMMY DATA
5. Username/password: bluebot/bluebot123 and you can see details of protection available
6. If you are doing professionally then you have to do reverse proxy from 443 to 3000 on nginx(on your instance) and add lets-encrypt and then point your CNAME to the cloud IP from godaddy/domain provider.
7. Then add this CNAME in basic-tracking.js in the above repo and paste this pixel in header tag (inside <script> basic-tracking.js code </script>)  of all your web pages.
8. Details of enhanced version will be released later for advanced protections like polyglots and DOM-XSS as there is performance penalty.


⚠️ Disclaimer
Traffic-Prism is provided "as is" without any warranties, express or implied. By using this software, you acknowledge that you are doing so at your own risk. The developers and contributors are not responsible for any damage or liability arising from the use of this software. See LICENSE.txt for complete disclaimer details.

🌟 Vision
At Bayesian Traffic-Prism our vision is quality cybersecurity should be free. Our mission is to democratize cybersecurity by providing enterprise grade open-source, transparent, and neutral tools that empower individuals, organizations, and governments to defend against evolving web-based threats. We believe that cybersecurity is a shared responsibility, and our platform bridges the gap between traditional WAFs and modern attack vectors like DOM-based XSS, session hijacking, and bot attacks.

Our ultimate goal is to become the "Hugging Face of Cybersecurity" —a global, community-driven initiative that fosters collaboration, innovation, and trust in the fight against cybercrime.

How to Install:

Please see Installation.md for detailed instructions. Docker instance for quick installation is planned. 

For professional installations and setting up of advanced rules and other features, you may want to consider our consulting/training offerings. Pl get in touch pbi@bayesiananalytics.in

🚀 What is Traffic-Prism?
Traffic-Prism is an adaptive, AI-powered web application firewall (WAF) designed to complement existing WAFs like Nginx firewall, ModSecurity and DDoS FastNetMon. It provides advanced features such as:

DOM-Based Attack Detection: Protects against modern client-side vulnerabilities like DOM XSS, DOM SQLi, and Clickjacking.

Session Intelligence: Monitors user sessions in real-time, calculating risk scores to identify and terminate risky sessions automatically.

Bayesian Risk Inference (Optional-Consulting): Combines historical pattern analysis with Gen AI-based scoring to detect zero-day attacks and sophisticated threats.

Bot Detection: Identifies and mitigates sophisticated bots and automated browser attacks using Playwright/Selenium.

🔒 Security Considerations
Traffic-Prism is designed to enhance web security but cannot guarantee protection against all threats.

Security is a layered approach; Traffic-Prism should be one component of your overall security strategy.

Regular security audits and updates to your entire infrastructure are still necessary.

Users are responsible for proper configuration and implementation within their environments.

📜 License
Traffic-Prism is licensed under dual license - Server Side Public License (SSPL) and Commercial one. SSPL license ensures that:

Anyone can use, modify software for internal use.

If you offer Traffic-Prism as a service (e.g., SaaS), you must also open-source your entire stack under the SSPL.

This protects the platform from being used without contributing back to the community.

For more details, see the LICENSE file. For end users there is no impact and they can freely use this software for their internal defenses.

Even if you are a hosted website like WordPress you can still host and avail this platform to track bots and prevent DOM XSS attacks.

📋 Commercial Licensing
For organizations requiring:

Custom implementations
Commercial support options
Alternative licensing terms
Enterprise features
Please contact us at pbi@bayesiananalytics.in to discuss commercial licensing options

We cover basic XSS / DOM XSS attacks in this code base. 

There are advanced XSS attacks/LDAP attacks/Polyglots that typically are experienced by high risk websites such as banks.

But to counter them we need to track lot more data points like XSS headers which may impact performance.

So they need to be carefully considered and implemented in enteprise environment. 

We offer consulting services/ training on how it can be implemented.

Gen AI and LLM provide extra scoring engine that is highly effective against zero day vulnerabilities. 

Our software component risk-analysis.ejs has the placeholder to either include API or your custom model and directly get Gen AI risk scores. 

However owing to extreme dynamic nature and frequent changes (DeepSeek was recent such event) we have left it to end users to implement their Gen AI model.

We will be happy to provide consultancy/training on how exactly such models can be trained. We highly recommened unsloth.ai for training your custom models.

Professional Consulting: To develop custom modules, Gen AI integration, PowerBI based advance reporting or for training / production support pl get in touch pbi@bayesiananalytics.in

🤝 How to Contribute
We welcome contributions from developers, researchers, and cybersecurity professionals worldwide! Here's how you can help:

Report Bugs: Open an issue on GitHub if you encounter any problems.

Submit Features: Fork the repository, implement your feature, and submit a pull request.

Improve Documentation: Help us make the documentation clearer and more comprehensive.

Spread the Word: Share Traffic-Prism with your network and encourage others to contribute.

Contribution Guidelines:

Follow the Code of Conduct.

Ensure your code adheres to our coding standards.

Include tests for new features or bug fixes.

Please add separate new endpoints and ejs in respective files with tests.

🌍 Community Resources

Website: Visit us at bayesiananalytics.com for more information.

GitHub Discussions: Post questions, share ideas, and connect with other users.

Email: For general inquiries only: pbi@bayesiananalytics.in

Coming soon: Discord channel.

Note: Owing to overwhelming response, kindly expect 3-4 days delays. 

This is a community-driven project where users help each other.

🏆 Acknowledgments
We would like to thank the following:

Open-Source Community: For inspiring us to build transparent, community-driven tools.

Early Adopters: For testing and providing feedback during the development phase.

📈 Future Roadmap

Our roadmap includes:

IoT Security: Extending our platform to secure IoT devices like smart meters.

Cloud Integration: Adding native support for cloud environments.

New Modules: Developing modules for emerging threats (e.g., API security, container protection,EDR enhancements).

Stay tuned for updates!

❤️ If you find Traffic-Prism valuable:

Star the Repository: Show your appreciation by starring this repo once it's live on GitHub.

Partner: Collaborate with us to enhance the ecosystem.

Thank you for being part of the Traffic-Prism journey. Together, we can make the internet safer for everyone! 
🌐🔒
