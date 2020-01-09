// Copyright (c) 2017-2020, The Particl Market developers
// Distributed under the GPL software license, see the accompanying
// file COPYING or https://github.com/particl/particl-market/blob/develop/LICENSE

import * as resources from 'resources';
import * as _ from 'lodash';
import { inject, named } from 'inversify';
import { Types, Core, Targets } from '../../../constants';
import { Logger as LoggerType } from '../../../core/Logger';
import { SmsgMessageStatus } from '../../enums/SmsgMessageStatus';
import { MarketplaceMessageEvent } from '../../messages/MarketplaceMessageEvent';
import { SmsgMessageService } from '../../services/model/SmsgMessageService';
import { MarketplaceMessage } from '../../messages/MarketplaceMessage';
import { ListingItemService } from '../../services/model/ListingItemService';
import { ActionListenerInterface } from '../ActionListenerInterface';
import { BidFactory } from '../../factories/model/BidFactory';
import { BidService } from '../../services/model/BidService';
import { MPActionExtended } from '../../enums/MPActionExtended';
import { EscrowRefundActionService } from '../../services/action/EscrowRefundActionService';
import { EscrowRefundMessage } from '../../messages/action/EscrowRefundMessage';
import { ProposalService } from '../../services/model/ProposalService';
import { BaseBidActionListenr } from '../BaseBidActionListenr';

export class EscrowRefundActionListener extends BaseBidActionListenr implements interfaces.Listener, ActionListenerInterface {

    public static Event = Symbol(MPActionExtended.MPA_REFUND);

    constructor(
        @inject(Types.Service) @named(Targets.Service.model.SmsgMessageService) public smsgMessageService: SmsgMessageService,
        @inject(Types.Service) @named(Targets.Service.action.EscrowRefundActionService) public escrowRefundActionService: EscrowRefundActionService,
        @inject(Types.Service) @named(Targets.Service.model.BidService) public bidService: BidService,
        @inject(Types.Service) @named(Targets.Service.model.ProposalService) public proposalService: ProposalService,
        @inject(Types.Service) @named(Targets.Service.model.ListingItemService) public listingItemService: ListingItemService,
        @inject(Types.Factory) @named(Targets.Factory.model.BidFactory) public bidFactory: BidFactory,
        @inject(Types.Core) @named(Core.Logger) Logger: typeof LoggerType
    ) {
        super(MPActionExtended.MPA_REFUND, smsgMessageService, bidService, proposalService, listingItemService, bidFactory, Logger);
    }

    /**
     * handles the received EscrowRefundMessage and return SmsgMessageStatus as a result
     *
     * @param event
     */
    public async onEvent(event: MarketplaceMessageEvent): Promise<SmsgMessageStatus> {

        const smsgMessage: resources.SmsgMessage = event.smsgMessage;
        const marketplaceMessage: MarketplaceMessage = event.marketplaceMessage;
        const actionMessage: EscrowRefundMessage = marketplaceMessage.action as EscrowRefundMessage;

        // - first get the previous Bid (MPA_BID), fail if it doesn't exist
        // - then get the ListingItem the Bid is for, fail if it doesn't exist
        // - then, save the new Bid (MPA_REFUND) and update the OrderItem.status and Order.status

        return await this.createChildBidCreateRequest(actionMessage, smsgMessage)
            .then(async bidCreateRequest => {
                return await this.escrowRefundActionService.createBid(actionMessage, bidCreateRequest)
                    .then(value => {
                        return SmsgMessageStatus.PROCESSED;
                    })
                    .catch(reason => {
                        return SmsgMessageStatus.PROCESSING_FAILED;
                    });
            })
            .catch(reason => {
                this.log.error('ERROR, reason: ', reason);
                return SmsgMessageStatus.PROCESSING_FAILED;
            });
    }
}
