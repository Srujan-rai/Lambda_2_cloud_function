//Action Types
export const QUERY_PARTICIPATION_RESULT_REQUEST = 'participationQuery/QUERY_PARTICIPATION_RESULT_REQUEST';
export const QUERY_PARTICIPATION_RESULT_SUCCESS = 'participationQuery/QUERY_PARTICIPATION_RESULT_SUCCESS';
export const QUERY_PARTICIPATION_RESULT_ERROR = 'participationQuery/QUERY_PARTICIPATION_RESULT_ERROR'; 
export const EMPTY_PARTICIPATIONS = 'participationQuery/EMPTY_PARTICIPATIONS';

//Action Creators For Participation Info
export const queryParticipationResultRequest = data => ({
    type: QUERY_PARTICIPATION_RESULT_REQUEST,
    payload: data
});

export const queryParticipationResultSuccess = response => ({
    type: QUERY_PARTICIPATION_RESULT_SUCCESS,
    payload: response
});

export const queryParticipationResultError = error => ({
    type: QUERY_PARTICIPATION_RESULT_ERROR,
    payload: error
});

export const emptyParticipations = () => ({
    type: EMPTY_PARTICIPATIONS
});