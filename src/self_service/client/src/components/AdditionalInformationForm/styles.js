import "react-datepicker/dist/react-datepicker.css";

const styles = (theme) => ({
    headerChip: {
        margin: "30px 0 30px 35px"
    },
    container: {
        width: "100%",
        marginLeft: "35px",
        display: "flex",
        flexDirection: "column",
        flexWrap: "wrap",
        justify: "flex-start",
        alignItems: "flex-start"
    },
    paper: {
        marginBottom: 20,
        paddingBottom: 20,
        width: '100%'
    },
    textField: {
        backgroundColor: "white",
        width: "260px",
        height: "35px",
        borderRadius: "5px",
        boxShadow: "0px 0px 0px 2px #f40000",
        paddingLeft: "10px",
        paddingRight: "5px",
        paddingTop: "5px",
        marginBottom: "10px",
        marginTop: "5px",
        marginLeft: 0,
        display: "flex",
        flexDirection: "column",
    },
    label: {
        width: "250px",
        display: "flex",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start",
        marginLeft: 0
    },
    rowContainer: {
        marginLeft: "35px",
        marginTop: "10px",
        display: "inline"
    },
    select: {
        width: "260px",
        marginLeft: "0",
        color: "black",
        borderRadius: "3px",
        boxShadow: "0px 0px 0px 2px #f40000",
        height: "35px",
        marginBottom: "10px",
        display: "flex",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start",
        paddingLeft: "20px",
        paddingTop: "3px",
        marginTop: "5px",
    },
    dateField: {
        border: "none",
        "&:focus": {
            outline: "none",
        },
        marginBottom: "5px"
    },
    calendarField: {
        marginLeft: "1px",
        marginTop: "30px",

    },
    textArea: {
        marginLeft: "50px",
        marginTop: "10px",
        height: "180px",
        marginBottom: "70px",
        marginLeft: 0,
        maxWidth: "460px",
        width: "460px"
    },
    checkboxCtnr: {
        width: "100%",
        display: "flex",
        justify: "flex-start",
        flexWrap: "wrap",
        marginLeft: "35px",
        alignItems: "flex-start",
        flexDirection: "column"
    },
    hideUploadImageUrl: {
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        width: "160px",
        position: "absolute",
        top: "6px",
        left: "85px",
        fontSize: "12px",
        backgroundColor: "#f40000" ,
        color: "white",
        paddingLeft: "5px"
    }
});

export default styles;