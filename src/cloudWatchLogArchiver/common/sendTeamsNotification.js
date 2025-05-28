function getTeamsMessage(logGroup, error) {
    const baseMessage = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: 'FF0000',
        summary: '🚨 URGENT: CloudWatch Log Export Failure',
        sections: [{
            activityTitle: `🚨 CRITICAL: CloudWatch Log Export Failure For ${logGroup.exportJobParams.logGroupName}`,
            text: '**IMMEDIATE ATTENTION REQUIRED**: This failure needs to be investigated as soon as possible.',
            markdown: true,
            facts: [
                {
                    name: 'Log Group Name',
                    value: logGroup.exportJobParams.logGroupName,
                },
                {
                    name: 'Log Group Export From Date',
                    value: new Date(logGroup.exportJobParams.exportFromDate).toISOString(),
                },
                {
                    name: 'Log Group Export To Date',
                    value: new Date(logGroup.exportJobParams.exportToDate).toISOString(),
                },
                {
                    name: 'Error Message',
                    value: error?.message || 'Unknown error',
                },
                {
                    name: 'Original Error',
                    value: error?.stack || 'Unknown error',
                },
                {
                    name: 'Time',
                    value: new Date(),
                },
            ],
        }],
    };

    return baseMessage;
}

/**
 * Sends a notification to Microsoft Teams when a CloudWatch log export fails
 * @param {Object} logGroup - The log group object containing export job parameters
 * @param {Error} error - The error that occurred during export
 * @throws {Error} If the Teams notification fails to send
 * @returns {Promise<void>}
 */
async function sendTeamsNotification(logGroup, error) {
    try {
        const response = await fetch(process.env.TEAMS_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getTeamsMessage(logGroup, error)),
        });

        if (!response.ok) throw new Error(`Teams API responded with status: ${response.status}`);
    } catch (err) {
        console.error('Failed to send Teams notification:', {
            error: err.message,
            logGroup: logGroup.exportJobParams.logGroupName,
        });
        throw new Error(`Failed to send Teams notification: ${err.message}`);
    }
}

module.exports = {
    sendTeamsNotification,
};
