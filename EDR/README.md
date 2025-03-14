From WAF to EDR: Bayesian Traffic-Prism Expands Its Cybersecurity Disruption 

Following the signficant adoption of our open-source Web Application Firewall (WAF), Bayesian Traffic-Prism is taking an even bolder step to democratize enterprise security. 

Building on the momentum and community response to our WAF solution, we're now extending our disruption to the Endpoint Detection and Response (EDR) market – a space with significantly higher stakes and traditionally dominated by solutions with price tags in the hundreds of thousands of dollars.

We have opensourced some of the detection capabilities that many commercial vendors lack.

We have uplaoded synthetic data (attack_dats.csv) to test 3 advanced cyber attacks which are slow moving, the exact kind of attacks happening now which lay dormant for days and sporadically exfiltreates as compelx attack chains

full_detect.py is algorithms to detect attack vectors as identified the attack description file.

test_full_detect.py is runnig implementation.

cjs file is a sample referece implementation of agent to collect telemetry data in clickhouse.. In actual scenarios you may want to build it as exe in c++ or c# but thats ur choice. This is least resistance agent.

You can query clickhouse and extract data in attack_data.csv and run above python scripts for slow moving attacks
