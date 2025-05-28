function prepareFormData(event) {
    event.preventDefault();
    let formStatus = $("#promotionForm").valid();
    if (formStatus) {
        formSubmission(
            $('#configurationId').val(),
            $('#promotionId').val(),
            $('#userId').val(),
            $('#jwt').val()
        );

    } else {
        $('.erroResponse').html("Sorry, something went wrong. Please try again!");
    }
}

//Button animation
const setBtnLoading = (btn) => {
    const submitBtn = $(btn);
    submitBtn.prop('disabled', true);
    if (!submitBtn.data('normal-text')) {
        submitBtn.data('normal-text', submitBtn.html());
    }
    submitBtn.html(submitBtn.data('loading-text'));
};

const clearBtnLoading = (btn) => {
    const submitBtn = $(btn);
    submitBtn.prop('disabled', false);
    submitBtn.html(submitBtn.data('normal-text'));
};

let jsSdkSubmitBtn = ``;

const validateFailHandler = res => {
    const data = JSON.stringify(res.data);
    console.log(`validateFailHandler -> ${data}`);

    $('.js-sdk-response').text(data);
    clearBtnLoading(jsSdkSubmitBtn);
};

const validateSuccessHandler = res => {
    console.log(`validateSuccessHandler -> ${res.data.message}`);
    setBtnLoading(jsSdkSubmitBtn);
};

const submitFailHandler = res => {
    const data = JSON.stringify(res.data);
    console.log(`submitFailHandler -> ${data}`);

    $('.js-sdk-response').text(`Error: ${data}`);

    clearBtnLoading(jsSdkSubmitBtn);
};

const submitSuccessHandler = res => {
    const data = JSON.stringify(res.data);
    console.log(`submitSuccessHandler -> ${data}`);

    $('.js-sdk-response').text(`Success: ${data}`);
    clearBtnLoading(jsSdkSubmitBtn);
};

const formMountHandler = res => {
    console.log(`formMountHandler -> ${res.data.message}`);

    clearBtnLoading('#submitFormBtn');
    let configPromoId = KoPromo._instance.config._config.promotionId;
    jsSdkSubmitBtn = `.promo-form-${configPromoId}-submit`;
    $('body').on('click', jsSdkSubmitBtn, () => {
        setBtnLoading(jsSdkSubmitBtn);
    });

    let jsSdkResponse = $('.js-sdk-response');

    if (!jsSdkResponse.length) {
        $('#js-sdk-container').after($('<p class="js-sdk-response"></p>').text(''));
    }
};

const beforeTplRenderHandler = res => {
    console.log(
        `BeforeTplRender
            tpl type -> ${res.data.type}
            tpl -> ${res.data.tpl}`
    );
};

function formSubmission(configId, promoId, userId, jwt) {
    let date = new Date();
    date.setTime(date.getTime() + (24*60*60*1000));
    let expires = "expires="+ date.toUTCString();
    document.cookie = "cds-current-user-token" + "=" + jwt + ";" + expires + ";path=/";
    console.log('Retrieve JS SDK');
    setBtnLoading('#submitFormBtn');

    new KoPromo({
        promotionId: promoId,
        elementId: 'js-sdk-container',
        responseCtnrId: 'js-sdk-response-container',
        errorCtnrId: 'js-sdk-error-container',
        listeners: {
            validateFail: validateFailHandler,
            validateSuccess: validateSuccessHandler,
            submitFail: submitFailHandler,
            submitSuccess: submitSuccessHandler,
            formMount: formMountHandler,
            beforeTplRender: beforeTplRenderHandler
        },
        configurationId: configId,
        userId: userId
    });
}

//# sourceURL=formSubmission.js