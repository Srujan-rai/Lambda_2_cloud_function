const prizeDrawPartExportCSVHeaders = [
    { label: 'User Id', value: 'gpp_user_id' },
    { label: 'Entry Date', value: 'entry_date' },
    { label: 'Participation Time', value: 'participation_time' },
    { label: 'Burned Pincode', value: 'successful_burns.pincode' },
    { label: 'Lot ID', value: 'successful_burns.lot_id' },
    { label: 'Prize ID', value: 'redeemed_prize.prize_id' },
    { label: 'Voucher Code ', value: 'redeemed_prize.voucher_code' },
    { label: 'Optional Information ', value: 'optional_information' },
    { label: 'Image Promo Entry', value: 'participation_image' },
];

const participationExportCSVHeaders = [
    { label: 'User Id', value: 'gpp_user_id', default: '' },
    { label: 'Entry Date', value: 'entry_date', default: '' },
    { label: 'Participation Time in Unix Timestamp', value: 'participation_time', default: '' },
    { label: 'Burned Pincode', value: 'successful_burns.pincode', default: '' },
    { label: 'Lot ID', value: 'successful_burns.lot_id', default: '' },
    { label: 'Prize ID', value: 'redeemed_prize.prize_id', default: '' },
    { label: 'Voucher Code ', value: 'redeemed_prize.voucher_code', default: '' },
    { label: 'Optional Information ', value: 'optional_information', default: '' },
];

module.exports = {
    prizeDrawPartExportCSVHeaders,
    participationExportCSVHeaders,
};
