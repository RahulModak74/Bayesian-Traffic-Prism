const clickhouse = require('../config/clickhouse').clickhouse;
const geoip = require('geoip-lite');

/**
 * Get IP details from region_details table
 */
async function getIpDetails(ipAddress) {
  try {
    const ipQuery = `SELECT country, region, city FROM region_details WHERE ip_address = '${ipAddress}' LIMIT 1;`;
    const ipResult = await clickhouse.query(ipQuery).toPromise();
    return ipResult[0];
  } catch (error) {
    console.error('Error fetching IP details:', error);
    return null;
  }
}

/**
 * Get GeoIP information for an IP address
 */
function getGeoLocation(ipAddress) {
  try {
    const geo = geoip.lookup(ipAddress);
    return {
      country: (geo && geo.country) ? geo.country.replace(/'/g, "''") : 'Unknown',
      region: (geo && geo.region) ? geo.region.replace(/'/g, "''") : 'Unknown',
      city: (geo && geo.city) ? geo.city.replace(/'/g, "''") : 'Unknown'
    };
  } catch (error) {
    console.error('Error getting geolocation:', error);
    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown'
    };
  }
}

module.exports = {
  getIpDetails,
  getGeoLocation
};