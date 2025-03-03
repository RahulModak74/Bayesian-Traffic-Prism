1. Bayesian Cybersecurity provides innovative approach to websecuirty by adding OLAP layer.
   
2. We have lot of open  source and closed source firewalls. All of them look at web traffic as an isolated url request. Some try to do ML and predictive analytics on them to figure out if it could be bot etc.
   
3a. In contrast, this software stores all journeys in real time in clickhouse which is superfast OLAP. And then runs set of  rules on the OLAP session to figure out if it could be bot. E.g. is more than 5 request ursl/sec or more than 25 requests per sec. So behaviour based evidence based detection. 

3b. Even for xss and sqli attacks that slip thru WAF, it does a  rule based analysis of the journeys and assigns scores and decides risks and flag. Also it stores all the data (persistance) for future IOC analysis or journey tracking. So compelx attack chains can not only be blocked but tracked too.  

4.In addition it provides a two way pixel where you can set  rules to kill the offending risky sessions in < 300 ms typically thus providing you with real time bot tracking/ XSS tracking and DOM side attack detection and termination that no WAF can provide since they are not designed for client side or behaviour based detections.

5. At conceptual level a static rule WAF like NAXSI (or nginx) or ModSecurity plus TrafficPrism and FastNetMon for DDoS can provide almost all points of commercial WAF and many more since evidence based protection is not possible with current WAFs.
   
6.For zero day attacks LLM based model integration can be a high value add. So you have an opensource benchmark to compare what additional features your commercial WAF is offering and do a cost benefit analysis even if you decide to stick with commerical options.

7. For low budget enterprises startups etc this combination can potentially offer similar level of protection that hitherto was not possible. Stress testing is recommended for your environment.
   
8. Gen AI & LLM provides excellent potential for zero day detection and  local custom models with ollama or trained models can be a perfcet combination for handling such risks.
   
9. Further customization of risk is possible through pymc3 based custom bayesian models. (How to  customize risks for your unique situation as a combination of OLAP and Gen AI risk.)
    
10.There are some advanced attacks and advanced situations like LDAP injections or header based complex attack chains or polyglots that typically are more relevant to high risk installations like financial services and we offer consulting / training about how those situations can be handled case to case basis. Extra data collection required for it will have some performance impact so its a technical trade off. 

11.Most important value addition is all the internals as well your data stays with you. When we got certified for ISO 27001 and SOC 2 as well GDPR this point was of high relevance as per auditors so hosting your own static firewall plus traffic prism and FastNetMon is 100% data safe approach.

12.Even for opensource version installation and setting rules and geography can be tricky and we offer 1 day- 3 day- 2 weeks one time options for those who may need assistance.
