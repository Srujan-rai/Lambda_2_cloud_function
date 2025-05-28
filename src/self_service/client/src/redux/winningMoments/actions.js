export const GENERATE_WINNING_MOMENTS = "winningMoments/GENERATE_WINNING_MOMENTS";
export const GENERATE_WINNING_MOMENTS_PER_PRIZE = "winningMoments/GENERATE_WINNING_MOMENTS_PER_PRIZE";
export const UPLOAD_WINNING_MOMENTS = "winningMoments/UPLOAD_WINNING_MOMENTS";
export const SERVE_WINNING_MOMENTS = "winningMoments/SERVE_WINNING_MOMENTS";
export const CLEAR_WINNING_MOMENTS = "winningMoments/CLEAR_WINNING_MOMENTS";

/**
 * Used for dispatching action upon generation of winning moments
 * @param {object} payload
 */
export const generateWinningMoments = payload => ({
    type: GENERATE_WINNING_MOMENTS, payload
});

/**
 * Used for dispatching action upon generation of winning moments per chosen prize
 * @param {object} payload
 */
export const generateWinningMomentsPerPrize = payload => ({
    type: GENERATE_WINNING_MOMENTS_PER_PRIZE, payload
});

/**
 * Used for dispatching action upon upload pregeneration winning moments from CSV file
 * @param {object} payload
*/
export const uploadWinningMoments = payload => ({
    type: UPLOAD_WINNING_MOMENTS, payload
});

/**
 * Used for dispatching action upon recieving the generated winning moments and preparing the for download
 * @param {object} payload
 */
export const serveWinningMoments = payload => ({
    type: SERVE_WINNING_MOMENTS, payload
});

/**
 * Used for dispatching action upon clearing the winning moments state
 * @param {object} payload
 */
export const clearWinningMoments = payload => ({
    type: CLEAR_WINNING_MOMENTS, payload
});