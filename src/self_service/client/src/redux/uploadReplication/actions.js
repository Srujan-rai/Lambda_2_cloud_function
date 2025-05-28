//Action Types
export const UPLOAD_REPLICATION = 'uploadReplication/UPLOAD_REPLICATION';

//Action Creators
export const uploadReplication = (payload, file) => ({
    type: UPLOAD_REPLICATION,
    payload,
    file
});
