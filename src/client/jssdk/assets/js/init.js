$("#privacyModal .modal-body").load("assets/t&c.txt");
$("header").load("assets/elements/header.html");
$("footer").load("assets/elements/footer.html");
//Fill fields with today's date.
$(function () {
    let date = new Date();
    //UTC timestamp for promo kick off
    const promoLive = 1538928060000;
    //UTC timestamp for promo end
    const promoEnd = 1977836800000;
    let dateMil = date.getTime();
    if (dateMil < promoLive) {
        $(".main-content").load("assets/elements/stayTuned.html");
    } else if (dateMil > promoEnd) {
        $(".main-content").load("assets/elements/promoEnded.html");
    } else {
        $(".main-content").load("assets/elements/promoForm.html", function () {
            retrieveJsSDK();
        });
    }
});

function retrieveJsSDK(koPromoEndpoint) {
    koPromoEndpoint = koPromoEndpoint ? koPromoEndpoint : "https://ngps-public-bucket-dev.s3-eu-west-1.amazonaws.com/sdk/KoPromo.js"

    $.getScript(koPromoEndpoint)
        .done(() => {
            console.log('JS SDK Retrieved Successfully');
            $('.main-content').append('<div id="js-sdk-container"><div>');
            $('.main-content').append('<div id="js-sdk-response-container"><div>');
            $('.main-content').append('<div id="js-sdk-error-container"><div>');
        })
}

function onTargetEnvChange(selectObj) { 
    let envEndpoint = selectObj.value;
    retrieveJsSDK(envEndpoint);
}

function changeFormErrorResponse(message) {
    $('.erroResponse').html(message);
    grecaptcha.reset();
}
function clearFormErrorResponse() {
    $('.erroResponse').html("");
}
