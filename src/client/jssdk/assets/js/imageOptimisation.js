var fileReader = new FileReader();
var filterType = /^(?:image\/jpeg|image\/png)$/i;
var uploadFile = "";
var optimisedImage = "";

var optimiseImage = function () {
    var uploadImage = document.getElementById("imageUploadInput");
    clearFormErrorResponse();
    //disable button while otpimising 
    $('#submitFormBtn').prop('disabled', true);
    //check and retuns the length of uploded file.
    if (uploadImage.files.length === 0) {
        document.getElementById("upload-Preview").src="";
        $('.imgPreviewWrap').hide();
        $('#imageUploadInput').valid();
        $('#submitFormBtn').prop('disabled', false);
        return;
    }

    //Is Used for validate a valid file.
    uploadFile = document.getElementById("imageUploadInput").files[0];
    if (!filterType.test(uploadFile.type)) {
        changeFormErrorResponse("Please select a valid image.");
        return;
    }

    $('.imgOptimisingStatus').html("Loading...");
    $('.imgPreviewWrap').show();
  fileReader.readAsDataURL(uploadFile);
};

fileReader.onload = function (event) {
    var image = new Image();
    var head = 'data:' + uploadFile.type+';base64,';
    var canvas = document.createElement("canvas");
    image.onload = function () {
        canvas.width = image.width;
        canvas.height = image.height;
        var data_url = drawCanvas(image,canvas, 1);
        var imgFileSize = Math.round((data_url.length - head.length) * 3 / 4);
        while (imgFileSize >  1000 * 1000 * 1.5) {
            data_url = drawCanvas(image,canvas, 2);
            imgFileSize = Math.round((data_url.length - head.length) * 3 / 4);
        }
        $('.imgUploadLoader').hide();
        $('.imgOptimisingStatus').html("Image preview. Not actual size.");
        optimisedImage = canvas.toDataURL(uploadFile.type);
        document.getElementById("upload-Preview").src = canvas.toDataURL(uploadFile.type);
        $('#submitFormBtn').prop('disabled', false);
    };
    image.src = event.target.result; 
    $('#imageUploadInput').valid();
    return 1;
};

function drawCanvas(image,canvas, reduceBy) {
    var context = canvas.getContext("2d");
    canvas.width = canvas.width / reduceBy;
    canvas.height = canvas.height / reduceBy;
    context.drawImage(image,
        0,
        0,
        image.width,
        image.height,
        0,
        0,
        canvas.width,
        canvas.height
    );
    return canvas.toDataURL(uploadFile.type);
}