$.validator.setDefaults({
    submitHandler: function (element, event) {
        prepareFormData(event);
    }
});

$("#promotionForm").validate({
    ignore: ".ignore",
    rules: {
        promotionId: {
            required: true
        },
        userId: {
            required: true
        }
    },
    errorElement: "p",
    errorPlacement: function (error, element) {
        //add bootstrap class for invalid feedback
        error.addClass("invalid-feedback");
        if (element.prop("type") === "checkbox") {
            error.insertAfter(element.parent(".form-check"));
        } else if (element.prop("type") === "tel") {
            error.insertAfter($(".tel-input-wrap"));
        } else if (element.prop("type") === "select-one") {
            error.insertAfter(element);
        } else if (element.prop("type") == "hidden") {
            error.insertAfter(element.parent(".form-check"));
        } else {
            error.insertAfter(element.parent(".form-group"));
        }
    },
    
    highlight: function (element) {
        $(element).addClass("is-invalid").removeClass("is-valid");
    },
    unhighlight: function (element) {
        $(element).addClass("is-valid").removeClass("is-invalid");
    }
});
//# sourceURL=formValidation.js