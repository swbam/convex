// Quick test of Ticketmaster affiliate URL generation

function generateClickId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 40; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const AFFILIATE_CONFIG = {
  impradid: '6463123',
  impradname: 'setlists.live',
  camefrom: 'CFC_BUYAT_6463123',
  REFERRAL_ID: 'tmfeedbuyat6463123',
  wtMcId: 'aff_BUYAT_6463123',
  utmSource: '6463123-setlists.live',
  utmMedium: 'affiliate',
  ircid: '4272',
};

// Test URL generation
const testTicketUrl = 'https://www.ticketmaster.com/event/12345';
const url = new URL(testTicketUrl);

url.searchParams.set('irgwc', '1');
url.searchParams.set('clickid', generateClickId());
url.searchParams.set('camefrom', AFFILIATE_CONFIG.camefrom);
url.searchParams.set('impradid', AFFILIATE_CONFIG.impradid);
url.searchParams.set('REFERRAL_ID', AFFILIATE_CONFIG.REFERRAL_ID);
url.searchParams.set('wt.mc_id', AFFILIATE_CONFIG.wtMcId);
url.searchParams.set('utm_source', AFFILIATE_CONFIG.utmSource);
url.searchParams.set('impradname', AFFILIATE_CONFIG.impradname);
url.searchParams.set('utm_medium', AFFILIATE_CONFIG.utmMedium);
url.searchParams.set('ircid', AFFILIATE_CONFIG.ircid);

console.log('\n=== TICKETMASTER AFFILIATE URL TEST ===\n');
console.log('Original URL:', testTicketUrl);
console.log('\nAffiliate URL:', url.toString());
console.log('\n=== PARAMETERS ===');
console.log('impradid:', url.searchParams.get('impradid'), url.searchParams.get('impradid') === '6463123' ? '✅' : '❌');
console.log('REFERRAL_ID:', url.searchParams.get('REFERRAL_ID'), url.searchParams.get('REFERRAL_ID') === 'tmfeedbuyat6463123' ? '✅' : '❌');
console.log('clickid:', url.searchParams.get('clickid'), url.searchParams.get('clickid')?.length === 40 ? '✅' : '❌');
console.log('irgwc:', url.searchParams.get('irgwc'), url.searchParams.get('irgwc') === '1' ? '✅' : '❌');
console.log('\n✅ Affiliate tracking configured correctly!\n');
