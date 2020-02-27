// Copyright (c) 2017-2020, The Particl Market developers
// Distributed under the GPL software license, see the accompanying
// file COPYING or https://github.com/particl/particl-market/blob/develop/LICENSE

import { IsNotEmpty } from 'class-validator';
import { RequestBody } from '../../../core/api/RequestBody';
import { ItemImageDataUpdateRequest } from './ItemImageDataUpdateRequest';
import { ModelRequestInterface } from './ModelRequestInterface';

// tslint:disable:variable-name
export class ItemImageUpdateRequest extends RequestBody implements ModelRequestInterface {

    @IsNotEmpty()
    public data: ItemImageDataUpdateRequest[];

    public hash: string;
    public featured: boolean;

}
// tslint:enable:variable-name
