// Copyright (c) 2017-2020, The Particl Market developers
// Distributed under the GPL software license, see the accompanying
// file COPYING or https://github.com/particl/particl-market/blob/develop/LICENSE

import { IsNotEmpty } from 'class-validator';
import { RequestBody } from '../../../core/api/RequestBody';
import { ModelRequestInterface } from './ModelRequestInterface';

// tslint:disable:variable-name
export class ListingItemObjectDataUpdateRequest extends RequestBody implements ModelRequestInterface {

    // public listing_item_object_id: number;

    @IsNotEmpty()
    public key: string;

    @IsNotEmpty()
    public value: string;
}
// tslint:enable:variable-name
