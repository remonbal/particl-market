// Copyright (c) 2017-2020, The Particl Market developers
// Distributed under the GPL software license, see the accompanying
// file COPYING or https://github.com/particl/particl-market/blob/develop/LICENSE

import * as resources from 'resources';
import * as _ from 'lodash';
import { inject, named } from 'inversify';
import { validate, request } from '../../../core/api/Validate';
import { Logger as LoggerType } from '../../../core/Logger';
import { Types, Core, Targets } from '../../../constants';
import { MarketService } from '../../services/model/MarketService';
import { RpcRequest } from '../../requests/RpcRequest';
import { Market } from '../../models/Market';
import { RpcCommandInterface } from '../RpcCommandInterface';
import { MarketCreateRequest } from '../../requests/model/MarketCreateRequest';
import { Commands} from '../CommandEnumType';
import { BaseCommand, CommandParamValidationRules, ParamValidationRule } from '../BaseCommand';
import { ModelNotFoundException } from '../../exceptions/ModelNotFoundException';
import { ProfileService } from '../../services/model/ProfileService';
import { MessageException } from '../../exceptions/MessageException';
import { CoreRpcService } from '../../services/CoreRpcService';
import { IdentityService } from '../../services/model/IdentityService';
import { ItemCategoryService } from '../../services/model/ItemCategoryService';
import { MarketAddMessage } from '../../messages/action/MarketAddMessage';
import { MarketCreateParams } from '../../factories/ModelCreateParams';
import { MarketFactory } from '../../factories/model/MarketFactory';
import { ContentReference, DSN, ProtocolDSN } from 'omp-lib/dist/interfaces/dsn';


export class MarketJoinCommand extends BaseCommand implements RpcCommandInterface<resources.Market> {

    constructor(
        @inject(Types.Core) @named(Core.Logger) public Logger: typeof LoggerType,
        @inject(Types.Factory) @named(Targets.Factory.model.MarketFactory) public marketFactory: MarketFactory,
        @inject(Types.Service) @named(Targets.Service.model.MarketService) private marketService: MarketService,
        @inject(Types.Service) @named(Targets.Service.model.IdentityService) private identityService: IdentityService,
        @inject(Types.Service) @named(Targets.Service.model.ProfileService) private profileService: ProfileService,
        @inject(Types.Service) @named(Targets.Service.model.ItemCategoryService) public itemCategoryService: ItemCategoryService,
        @inject(Types.Service) @named(Targets.Service.CoreRpcService) public coreRpcService: CoreRpcService
    ) {
        super(Commands.MARKET_JOIN);
        this.log = new Logger(__filename);
    }

    public getCommandParamValidationRules(): CommandParamValidationRules {
        return {
            params: [{
                name: 'profileId',
                required: true,
                type: 'number'
            }, {
                name: 'marketId',
                required: true,
                type: 'number'
            }, {
                name: 'identityId',
                required: false,
                type: 'number'
            }] as ParamValidationRule[]
        } as CommandParamValidationRules;
    }

    /**
     * data.params[]:
     *  [0]: profile: resources.Profile
     *  [1]: market: resources.Market
     *  [2]: identity: resources.Identity, optional
     *
     * @param data
     * @returns {Promise<Market>}
     */
    @validate()
    public async execute( @request(RpcRequest) data: RpcRequest): Promise<resources.Market> {
        const profile: resources.Profile = data.params[0];
        const marketToJoin: resources.Market = data.params[1];
        let identity: resources.Identity = data.params[2];

        this.log.debug('marketToJoin: ', JSON.stringify(marketToJoin, null, 2));

        // create market identity if one wasn't given
        if (_.isNil(identity)) {
            identity = await this.identityService.createMarketIdentityForProfile(profile, marketToJoin.name).then(value => value.toJSON());
        }

        const createRequest: MarketCreateRequest = await this.marketFactory.get({
            actionMessage: {
                name: marketToJoin.name,
                description: marketToJoin.description,
                marketType: marketToJoin.type,
                region: marketToJoin.region,
                receiveKey: marketToJoin.receiveKey,
                publishKey: marketToJoin.receiveKey,
                image: marketToJoin.Image ? {
                    hash: marketToJoin.Image.hash,
                    data: marketToJoin.Image.ImageDatas ? [{
                        protocol: ProtocolDSN.FILE,
                        dataId: marketToJoin.Image.ImageDatas[0].dataId,
                        encoding: marketToJoin.Image.ImageDatas[0].encoding,
                        data: marketToJoin.Image.ImageDatas[0].data
                    }] as DSN[] : undefined,
                    featured: marketToJoin.Image.featured
                } as ContentReference : undefined,
                generated: Date.now()
            } as MarketAddMessage,
            identity,
            skipJoin: false
        } as MarketCreateParams);

        // create the market
        return await this.marketService.create(createRequest).then(async value => {
            const market: resources.Market = value.toJSON();
            this.log.debug('market: ', JSON.stringify(market, null, 2));

            if (!_.isNil(market.Identity.id) && !_.isNil(market.Identity.Profile.id)) {
                await this.marketService.joinMarket(market);
            }

            // create root category for market
            await this.itemCategoryService.insertRootItemCategoryForMarket(createRequest.receiveAddress);

            return market;
        });
    }

    /**
     * data.params[]:
     *  [0]: profileId
     *  [1]: marketId
     *  [2]: identityId, optional
     *
     * @param {RpcRequest} data
     * @returns {Promise<RpcRequest>}
     */
    public async validate(data: RpcRequest): Promise<RpcRequest> {
        await super.validate(data); // validates the basic search params, see: BaseSearchCommand.validateSearchParams()

        const profileId = data.params[0];
        const marketId = data.params[1];
        const identityId = data.params[2];

        // make sure Profile with the id exists
        const profile: resources.Profile = await this.profileService.findOne(profileId)
            .then(value => value.toJSON())
            .catch(reason => {
                throw new ModelNotFoundException('Profile');
            });

        // make sure Market with the id exists
        const market: resources.Market = await this.marketService.findOne(marketId)
            .then(value => value.toJSON())
            .catch(reason => {
                throw new ModelNotFoundException('Market');
            });

        let identity: resources.Identity | undefined;

        if (!_.isNil(identityId)) {
            // make sure Identity with the id exists
            identity = await this.identityService.findOne(identityId)
                .then(value => value.toJSON())
                .catch(reason => {
                    throw new ModelNotFoundException('Identity');
                });

            // make sure Identity belongs to the given Profile
            if (identity!.Profile.id !== profile.id) {
                throw new MessageException('Identity does not belong to the Profile.');
            }
        }

        if (!_.isNil(market.Profile)) {
            throw new MessageException('Market has already been joined.');
        }

        await this.marketService.findOneByProfileIdAndReceiveAddress(profileId, market.receiveAddress)
            .then(value => {
                throw new MessageException('You have already joined this Market.');
            })
            .catch(reason => {
                //
            });

        data.params[0] = profile;
        data.params[1] = market;
        data.params[2] = identity;

        return data;
    }

    public usage(): string {
        return this.getName() + ' <profileId> <marketId> [identityId]';
    }

    public help(): string {
        return this.usage() + ' -  ' + this.description() + ' \n'
            + '    <profileId>              - number - The ID of the Profile for which the Market is added. \n'
            + '    <marketId>               - string - The unique name of the Market being created. \n'
            + '    <identityId>             - [optional] number, The Identity to be used with the Market. \n';
    }

    public description(): string {
        return 'Join a new Market.';
    }

    public example(): string {
        return 'market ' + this.getName() + ' market add 1 \'mymarket\' \'MARKETPLACE\' \'2Zc2pc9jSx2qF5tpu25DCZEr1Dwj8JBoVL5WP4H1drJsX9sP4ek\' ' +
            '\'2Zc2pc9jSx2qF5tpu25DCZEr1Dwj8JBoVL5WP4H1drJsX9sP4ek\' ';
    }
}
