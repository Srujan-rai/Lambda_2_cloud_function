export default () => ({
        root: {
            color: "#f40000",
            marginBottom: "50px"
        },
        chip: {
            margin: "30px 0px 20px 30px"
        },
        modal: {
            background: 'white',
            maxWidth: '600px',
            margin:'0 auto',
            padding:'20px',
            marginTop:'20px'
        },
        container: {
            width: "100%",
            display: "flex",
            flexDirection: "row",
            marginTop: "30px",
            flexWrap: "wrap",
            justify: "flex-start",
            alignItems: "flex-start",
        },
        textField: {
            backgroundColor: "white",
            height: "35px",
            borderRadius: "5px",
            boxShadow: "0px 0px 0px 2px #f40000",
            paddingLeft: "10px",
            paddingRight: "5px",
            paddingTop: "5px",
            marginTop: "5px",
            display: "flex",
            flexDirection: "row",
            minWidth: '260px',
            flexBasis: "470px"
        },
        validityField: {
            backgroundColor: "white",
            height: "35px",
            borderRadius: "5px",
            boxShadow: "0px 0px 0px 2px #f40000",
            paddingLeft: "10px",
            paddingRight: "5px",
            paddingTop: "5px",
            marginTop: "5px",
            display: "flex",
            minWidth: '260px',
            width: "100%",
            flexBasis: "470px"
        },
        label: {
            width: "250px",
            flexDirection: "row",
            justify: "flex-start",
            alignItems: "flex-start",
            display: "inherit"
        },
        labelTooltip: {
            width: "250px",
            display: "flex",
            justify: "flex-start",
            alignItems: "flex-start"
        },
        rowContainer: {
            marginTop: "10px",
            padding: "0px 25px 0px 35px",
            display: "inline",
            flexDirection: "column",
            justify: "flex-start",
            alignItems: "flex-start",
            minHeight: "100px",
            flex: 2,
            maxWidth: '600px'
        },
        rowContainer2: {
           marginTop: "10px",
           padding: "0px 25px 0px 35px",
           display: "inline",
           flexDirection: "column",
           justify: "flex-start",
           alignItems: "flex-start",
           minHeight: "100px",
           flex: 1,
           maxWidth: '320px'
        },
        sdkContainer: {
            marginTop: "10px",
            padding: "0px 25px 0px 35px",
            display: "block",
            flexDirection: "column",
            justify: "flex-start",
            alignItems: "flex-start",
            minHeight: "100px",
            flex: 1,
            maxWidth: '320px'
         },
        select: {
            minWidth: "260px",
            flexBasis: '470px',
            marginBottom:"5px",
            color: "black",
            borderRadius: "5px",
            boxShadow: "0px 0px 0px 2px #f40000",
            height: "35px",
            display: "flex",
            flexDirection: "column",
            justify: "flex-start",
            alignItems: "flex-start",
            paddingLeft: "20px",
            paddingTop: "3px",
            marginTop: "0px"
        },
        selectTemplate: {
            minWidth: "260px",
            maxWidth: "600px"
        },
        button: {
            marginBottom: "50px",
            marginTop: "30px",
            color: "white",
            height: "35px",
            width: "100px",
            backgroundColor: "#f40000",
            borderRadius: "5px solid white"
        },
        buttonContainer: {
            flexBasis: "100%",
            marginLeft: "65px",
            marginTop: "5px"
        },
        dateField: {
            border: "none",
            "&:focus": {
                outline: "none",
            },
            marginBottom: "5px",
        },
        calendarField: {
            marginLeft: "1px",
            marginTop: "30px",
        },
        messages: {
            color: "red",
            fontWeight: "bold",
            fontSize: 12,
        },
        displayAdditionalInfo: {
            marginTop: "30px",
            minHeight: "inherit"
        }
    });
