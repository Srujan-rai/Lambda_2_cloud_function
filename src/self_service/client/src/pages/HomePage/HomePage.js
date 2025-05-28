import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import CardItem from '../../components/CardItem';
import Page from '../../components/Page';
import links from '../../constants/links';
import Can from '../../components/Can/Can';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = () => ({
    gridContainer: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gridGap: "30px"
    }
});

//TODO Add image for media section after decision
const HomePage = ({ classes }) => {
    return (
        <Page>
            <div className={classes.gridContainer}>
                <Can roles={["prizeManager", "superUser", "prizeAuthor", "promotionAuthor", "prizeEconomyManager"]}
                    yes={() => (
                        <CardItem className={classes.cardItem}
                            title="Prize Catalogue Management"
                            description="Add Edit Delete"
                            image=""
                            avatar="PC"
                            actions={links.getPrizesLinks()}
                        />)}

                />
                {/* <CardItem className={classes.cardItem}
                    title="Promotion Configuration Management"
                    description="Configure Promotion"
                    image=""
                    avatar="CO"
                    actions={links.getConfigurationsLinks()}
                /> */}
                <Can roles={["promotionManager", "superUser", "prizeEconomyManager", "promotionAuthor"]}
                     yes={() => (
                         <CardItem className={classes.cardItem}
                                   title="Currency Allocation Rules"
                                   description="List, create and edit rules"
                                   image=""
                                   avatar="CR"
                                   actions={links.getCurrencyAllocationRulesLinks()}
                         />)}

                />
                <Can roles={["promotionManager", "superUser", "promotionAuthor"]}
                     yes={() => (
                         <CardItem className={classes.cardItem}
                                   title="Promotions Management"
                                   description="List, create and edit promotions"
                                   image=""
                                   avatar="PM"
                                   actions={links.getPromotionsLinks()}
                         />)}

                />
                <Can roles={["prizeManager", "superUser", "promotionAuthor"]}
                     yes={() => (
                         <CardItem className={classes.cardItem}
                                   title="Configuration Management"
                                   description="Configure Promotion"
                                   image=""
                                   avatar="CO"
                                   actions={links.getConfigurationsLinks()}
                         />)}

                />
                <Can roles={["consumerSupport", "superUser", "promotionAuthor"]}
                     yes={() => (
                         <CardItem className={classes.cardItem}
                                   title="Analysis Operations"
                                   description="Choose a functionality"
                                   image=""
                                   avatar="AO"
                                   actions={links.getAnalysisLinks()}
                         />)}

                />
                <Can roles={["promotionManager", "promotionAuthor", "superUser"]}
                     yes={() => (
                         <CardItem className={classes.cardItem}
                                   title="Winning Moments Management"
                                   description="Adding and listing"
                                   image=""
                                   avatar="WM"
                                   actions={links.getWinningMomentsLinks()}
                         />)}

                />
                <Can roles={["promotionManager", "superUser", "promotionAuthor"]}
                     yes={() => (
                         <CardItem className={classes.cardItem}
                                   title="Email Templates Management"
                                   description="Adding and Editing templates"
                                   image=""
                                   avatar="ET"
                                   actions={links.getEmailTemplatesLinks()}
                         />)}

                />
                <Can roles={["consumerSupport", "superUser"]}
                     yes={() => (
                         <CardItem className={classes.cardItem}
                                   title="Participations Information"
                                   description="Search participations using various filters"
                                   image=""
                                   avatar="PI"
                                   actions={links.getParticipationsLinks()}
                         />)}

                />
                <Can roles={["consumerSupport", "superUser"]}
                     yes={() => (
                         <CardItem className={classes.cardItem}
                                   title="Consumer Blocking"
                                   description="Block user by ID"
                                   image=""
                                   avatar="CB"
                                   actions={links.getConsumerBlockingLinks()}
                         />)}

                />
                <Can roles={["promotionManager", "promotionAuthor", "superUser"]}
                     yes={() => (
                         <CardItem className={classes.cardItem}
                                   title="Currency Creation"
                                   description="Create new currency"
                                   image=""
                                   avatar="CC"
                                   actions={links.getCurrencyCreationLinks()}
                         />)}
                />
                <Can roles={["promotionManager", "superUser", "promotionAuthor"]}
                     yes={() => (
                         <CardItem className={classes.cardItem}
                                   title="Replications Management"
                                   description="Download or Upload Replicaiton package"
                                   image=""
                                   avatar="RM"
                                   actions={links.getReplicationLinks()}
                         />)}
                />
            </div>
        </Page>
    );
};

HomePage.propTypes = propTypes;

export default withStyles(styles)(HomePage);