import type { Request, Response } from 'express';
import { Address, Cell } from '@ton/core';
import { VanityNetwork } from '../vanity/entities/vanity-generation.entity';

interface ToncenterAddressInformation {
  code: string;
  data: string;
  state: string;
}

interface ToncenterJsonRpcResponse {
  ok?: boolean;
  result?: ToncenterAddressInformation;
  error?: {
    code?: number;
    message?: string;
  };
}

function normalizeNetwork(network: unknown): VanityNetwork {
  return network === VanityNetwork.TESTNET ? VanityNetwork.TESTNET : VanityNetwork.MAINNET;
}

function getToncenterRpcUrl(network: VanityNetwork): string {
  if (network === VanityNetwork.TESTNET) {
    return process.env.TONCENTER_TESTNET_RPC_URL || 'https://testnet.toncenter.com/api/v2/jsonRPC';
  }

  return process.env.TONCENTER_MAINNET_RPC_URL || 'https://toncenter.com/api/v2/jsonRPC';
}

function decodeAddressInfo(result: ToncenterAddressInformation, isTestnet: boolean) {
  if (!result.code || !result.data || result.state !== 'active') {
    throw new Error('Token master account is not active or has no code/data on-chain');
  }

  const codeCell = Cell.fromBoc(Buffer.from(result.code, 'base64'))[0];
  const dataCell = Cell.fromBoc(Buffer.from(result.data, 'base64'))[0];
  const parser = dataCell.beginParse();

  const totalSupply = parser.loadCoins();
  const adminAddress = parser.loadAddress();
  const contentCell = parser.loadRef();
  const walletCodeCell = parser.loadRef();

  return {
    tokenMasterCodeBoc: codeCell.toBoc().toString('base64'),
    tokenWalletCodeBoc: walletCodeCell.toBoc().toString('base64'),
    tokenAdminAddress: adminAddress.toString({ bounceable: true, urlSafe: true, testOnly: isTestnet }),
    tokenContentCellBoc: contentCell.toBoc().toString('base64'),
    tokenTotalSupply: totalSupply.toString(),
  };
}

export const resolveTokenTemplate = async (req: Request, res: Response) => {
  const { tokenAddress, network } = req.body;

  if (!tokenAddress || typeof tokenAddress !== 'string') {
    return res.status(400).json({ success: false, error: 'tokenAddress is required' });
  }

  let parsedAddress: Address;
  try {
    parsedAddress = Address.parse(tokenAddress);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid tokenAddress format' });
  }

  const normalizedNetwork = normalizeNetwork(network);
  const rpcUrl = getToncenterRpcUrl(normalizedNetwork);

  try {
    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.TONCENTER_API_KEY ? { 'X-API-Key': process.env.TONCENTER_API_KEY } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAddressInformation',
        params: {
          address: parsedAddress.toString({ bounceable: true, urlSafe: true, testOnly: normalizedNetwork === VanityNetwork.TESTNET }),
        },
      }),
    });

    if (!rpcResponse.ok) {
      const errorText = await rpcResponse.text();
      throw new Error(`Failed to fetch token template from chain (${rpcResponse.status}): ${errorText}`);
    }

    const body = (await rpcResponse.json()) as ToncenterJsonRpcResponse;
    if (body.error || !body.result) {
      throw new Error(body.error?.message || 'Failed to fetch token template from chain');
    }

    const template = decodeAddressInfo(body.result, normalizedNetwork === VanityNetwork.TESTNET);
    return res.json({
      success: true,
      network: normalizedNetwork,
      sourceTokenAddress: parsedAddress.toString({ bounceable: true, urlSafe: true, testOnly: normalizedNetwork === VanityNetwork.TESTNET }),
      ...template,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(400).json({ success: false, error: message });
  }
};
