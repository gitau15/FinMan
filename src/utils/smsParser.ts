import { type Transaction } from '../db';

export function parseMpesaSMS(text: string): Partial<Transaction> | null {
  // Example: L739H12345 Confirmed. Ksh1,200.00 paid to SAFARICOM HOUSE. on 19/2/26 at 6:55 PM. New M-PESA balance is Ksh5,432.10. Transaction cost, Ksh15.00.
  
  const mpesaIdMatch = text.match(/^([A-Z0-9]+)\sConfirmed/i);
  if (!mpesaIdMatch) return null;

  const mpesaId = mpesaIdMatch[1];
  
  // Extract Amount
  const amountMatch = text.match(/Ksh\s?([\d,]+\.\d{2})/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

  // Extract Balance
  const balanceMatch = text.match(/balance is Ksh\s?([\d,]+\.\d{2})/i);
  const balance = balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : 0;

  // Extract Cost
  const costMatch = text.match(/cost,\s?Ksh\s?([\d,]+\.\d{2})/i);
  const cost = costMatch ? parseFloat(costMatch[1].replace(/,/g, '')) : 0;

  // Extract Date and Time
  const dateMatch = text.match(/on\s(\d{1,2}\/\d{1,2}\/\d{2,4})\sat\s(\d{1,2}:\d{2}\s[AP]M)/i);
  let date = new Date();
  if (dateMatch) {
    const [_, dateStr, timeStr] = dateMatch;
    // Basic parsing, might need adjustment for different locales
    // Assuming D/M/Y or M/D/Y based on Kenya standard (usually D/M/Y)
    const [d, m, y] = dateStr.split('/').map(Number);
    const fullYear = y < 100 ? 2000 + y : y;
    
    // Time parsing
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
    
    date = new Date(fullYear, m - 1, d, hours, minutes);
  }

  // Determine Type and Merchant
  let type: Transaction['type'] = 'other';
  let merchant = 'Unknown';

  if (text.includes('paid to')) {
    type = 'paybill';
    const match = text.match(/paid to\s(.*?)\.\son/i);
    merchant = match ? match[1].trim() : 'Unknown Merchant';
  } else if (text.includes('sent to')) {
    type = 'send';
    const match = text.match(/sent to\s(.*?)\son/i);
    merchant = match ? match[1].trim() : 'Unknown Recipient';
  } else if (text.includes('received Ksh')) {
    type = 'receive';
    const match = text.match(/from\s(.*?)\son/i);
    merchant = match ? match[1].trim() : 'Unknown Sender';
  } else if (text.includes('Withdraw')) {
    type = 'withdraw';
    const match = text.match(/from\s(.*?)\son/i);
    merchant = match ? match[1].trim() : 'Agent';
  } else if (text.includes('Buy Goods')) {
    type = 'buygoods';
    const match = text.match(/to\s(.*?)\son/i);
    merchant = match ? match[1].trim() : 'Merchant';
  }

  return {
    mpesaId,
    amount,
    balance,
    cost,
    date,
    type,
    merchant,
    rawText: text
  };
}
