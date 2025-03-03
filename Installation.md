How to install

1. Create a new cloud instance and map it with cname to your domain (e.g. https://metrics.mydomain.com)

Create reverse proxy using nginx from 443 to 8000.

2. Install clickhouse on the instance and create all tables in Main_cyber_clickhouse_tables.txt

3.Change the cname to the IP value in the pixel basic-tracking.js and copy the pixel in the header file of your website

4. Clone the repo and install all packages and run app.js (ideally with pm2)

5. All the visits on your website shud be tracked inside tracking10 table

6. You will need to deicde which IP config tracking npm package you want to use and install it accordingly and create list of all cities available and load it in table region_details

7. Set default user name and pwd in users table 

8. Go to https://metrics.mydomain.com


Installation may be bit complex you can simply use our docker instance which will take care of all steps expcet #3 which you will need to do manually

Pl get in touch pbi@bayesiananalytics.in or our discord channel
