Bayesian Traffic-Prism: Open-Source Web Security for All

You can use us alongwith any commercial WAF to detect and terminate behavior based bots, clickjacking, cross request patterns, DOM XSS attacks.

You can use us alongwith opensource static WAFs and you can match many of the features of commercial WAFs like bot detection and termination.

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
At Bayesian Traffic-Prism our vision  is to democratize cybersecurity by providing enterprise grade open-source, transparent, and neutral tools that empower individuals, organizations, and governments to defend against evolving web-based threats. 

How to Install:

Pl see DETAILED_DOCUMENTATION.md for  details

For professional installations and setting up of advanced rules and other features, you may want to consider our consulting/training offerings. Pl get in touch pbi@bayesiananalytics.in

🚀 What is Traffic-Prism?
Traffic-Prism is an adaptive, AI-powered web application firewall (WAF) designed to complement existing WAFs like Nginx firewall, ModSecurity and DDoS FastNetMon.

Gen AI and LLM provide extra scoring engine that is highly effective against zero day vulnerabilities. 

Our software component risk-analysis.ejs has the placeholder to either include API or your custom model and directly get Gen AI risk scores. 

Professional Consulting: To develop custom modules, advanced attacks like Polyglot, Gen AI integration, Slow moving attack detection EDR capabilities rivalling or even potentially exceeding leading vendors and  reporting or for training / production support pl get in touch pbi@bayesiananalytics.in

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
