const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { CreateScheduleCommand } = require('@aws-sdk/client-scheduler');
const { createSchedulerClientManager } = require('../../awsSdkClientManager');

const schedulerClientManager = createSchedulerClientManager();

const createSchedule = async (commandInput) => {
    const schedulerClient = captureAWSv3Client(schedulerClientManager.getClient());
    const createScheduleCommand = new CreateScheduleCommand(commandInput);
    try {
        const response = await schedulerClient.send(createScheduleCommand);
        console.log('The schedule was successfully created!');
        return response;
    } catch (e) {
        console.log('Creating the schedule failed due to', e);
    }
};

module.exports = {
    createSchedule,
};
