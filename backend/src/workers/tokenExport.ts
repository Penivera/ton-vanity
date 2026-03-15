import type { Request, Response } from 'express';
import { Address, beginCell, Cell, contractAddress, storeStateInit } from '@ton/core';
import type { StateInit } from '@ton/core';
import { VanityNetwork } from '../vanity/entities/vanity-generation.entity';

interface TokenExportRequestBody {
  tokenMasterCodeBoc?: string;
  tokenWalletCodeBoc?: string;
  tokenAdminAddress?: string;
  tokenContentCellBoc?: string;
  tokenTotalSupply?: string;
  salt?: string;
  network?: VanityNetwork | string;
  value?: string;
  generatedAddress?: string;
}

function normalizeNetwork(network: unknown): VanityNetwork {
  return network === VanityNetwork.TESTNET ? VanityNetwork.TESTNET : VanityNetwork.MAINNET;
}

function parseRequiredString(value: unknown, fieldName: string): string {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function parseNonNegativeInt(value: string, fieldName: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${fieldName} must be a non-negative integer string`);
  }

  return BigInt(value);
}

export const exportTokenDeploymentPayload = async (req: Request, res: Response) => {
  const body = req.body as TokenExportRequestBody;

  try {
    const tokenMasterCodeBoc = parseRequiredString(body.tokenMasterCodeBoc, 'tokenMasterCodeBoc');
    const tokenWalletCodeBoc = parseRequiredString(body.tokenWalletCodeBoc, 'tokenWalletCodeBoc');
    const tokenAdminAddressRaw = parseRequiredString(body.tokenAdminAddress, 'tokenAdminAddress');
    const saltRaw = parseRequiredString(body.salt, 'salt');

    const value = body.value && body.value.trim().length > 0 ? body.value.trim() : '80000000';
    const network = normalizeNetwork(body.network);

    const masterCodeCell = Cell.fromBoc(Buffer.from(tokenMasterCodeBoc, 'base64'))[0];
    const walletCodeCell = Cell.fromBoc(Buffer.from(tokenWalletCodeBoc, 'base64'))[0];
    const tokenAdminAddress = Address.parse(tokenAdminAddressRaw);
    const tokenContentCell = body.tokenContentCellBoc && body.tokenContentCellBoc.trim().length > 0
      ? Cell.fromBoc(Buffer.from(body.tokenContentCellBoc.trim(), 'base64'))[0]
      : beginCell().storeUint(0, 8).endCell();

    const tokenTotalSupply = body.tokenTotalSupply && body.tokenTotalSupply.trim().length > 0
      ? parseNonNegativeInt(body.tokenTotalSupply.trim(), 'tokenTotalSupply')
      : 0n;
    const salt = parseNonNegativeInt(saltRaw, 'salt');

    const tokenDataCell = beginCell()
      .storeCoins(tokenTotalSupply)
      .storeAddress(tokenAdminAddress)
      .storeRef(tokenContentCell)
      .storeRef(walletCodeCell)
      .storeUint(salt, 64)
      .endCell();

    const stateInit: StateInit = {
      code: masterCodeCell,
      data: tokenDataCell,
    };

    const stateInitCell = beginCell().store(storeStateInit(stateInit)).endCell();
    const address = contractAddress(0, stateInit);

    if (body.generatedAddress && body.generatedAddress.trim().length > 0) {
      const generatedAddress = Address.parse(body.generatedAddress.trim());
      if (generatedAddress.toRawString() !== address.toRawString()) {
        throw new Error('generatedAddress does not match the derived address from the current token settings');
      }
    }

    const deploymentAddress = address.toString({
      bounceable: true,
      testOnly: network === VanityNetwork.TESTNET,
      urlSafe: true,
    });

    return res.json({
      success: true,
      network,
      address: deploymentAddress,
      rawAddress: address.toRawString(),
      stateInit: stateInitCell.toBoc().toString('base64'),
      value,
      transactionPayload: {
        validUntil: Math.floor(Date.now() / 1000) + 360,
        messages: [
          {
            address: deploymentAddress,
            amount: value,
            stateInit: stateInitCell.toBoc().toString('base64'),
          },
        ],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(400).json({ success: false, error: message });
  }
};
