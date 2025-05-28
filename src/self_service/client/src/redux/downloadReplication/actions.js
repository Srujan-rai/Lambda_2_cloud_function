//Action Types
export const DOWNLOAD_REPLICATION = 'downloadReplication/DOWNLOAD_REPLICATION';

//Action Creators
export const downloadReplication = data => ({
    type: DOWNLOAD_REPLICATION,
    payload: data
});
