import { program } from 'commander';
import * as fs from 'fs';
import log from 'loglevel';
import * as path from 'path';
import { URL } from 'url';
import { getAssetManifest } from './commands/upload';
import { loadCandyProgramV2, loadWalletKey } from './helpers/accounts';
import { StorageType } from './helpers/storage-type';
import { arweaveUpload } from './helpers/upload/arweave';
import { awsUpload } from './helpers/upload/aws';
import { ipfsUpload } from './helpers/upload/ipfs';
import {
  nftStorageClient,
  nftStorageManifestJson,
  nftStorageUpload,
  nftStorageUploadMedia,
  nftStorageUploadMetadata,
} from './helpers/upload/nft-storage';
import { pinataUpload } from './helpers/upload/pinata';

program.version('1.1.0');
log.setLevel('info');

programCommand('upload-to-storage')
  .requiredOption('-f, --file <string>', 'metadata json file')
  .requiredOption('-s, --storage <string>', 'storage type')
  .option('-r, --rpc-url <string>', 'Optional: Custom RPC url')
  .option('--nft-storage-key <string>', 'Optional: NFT storage key')
  .option('--ipfs-credentials <string>', 'Optional: IPFS credentials')
  .option('--pinata-jwt <string>', 'Optional: Pinata JWT')
  .option('--pinata-gateway <string>', 'Optional: Pinata Gateway')
  .option('--aws-s3-bucket <string>', 'Optional: AWS S3 Bucket')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const {
      keypair,
      env,
      rpcUrl,
      file,
      storage,
      nftStorageKey,
      ipfsCredentials,
      pinataJwt,
      pinataGateway,
      awsS3Bucket,
    } = cmd.opts();
    const walletKeypair = loadWalletKey(keypair);
    const anchorProgram = await loadCandyProgramV2(walletKeypair, env, rpcUrl);

    const { dir: dirname, name: index } = path.parse(file);
    const asset = { index };
    const manifest = getAssetManifest(
      dirname,
      asset.index.includes('json') ? asset.index : `${asset.index}.json`,
    );

    const image = path.join(dirname, `${manifest.image}`);
    const animation =
      'animation_url' in manifest
        ? path.join(dirname, `${manifest.animation_url}`)
        : undefined;
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));

    if (
      animation &&
      (!fs.existsSync(animation) || !fs.lstatSync(animation).isFile())
    ) {
      throw new Error(
        `Missing file for the animation_url specified in ${asset.index}.json`,
      );
    }

    let link, imageLink, animationLink;
    try {
      switch (storage) {
        case StorageType.Pinata:
          [link, imageLink, animationLink] = await pinataUpload(
            image,
            animation,
            manifestBuffer,
            pinataJwt,
            pinataGateway,
          );
          break;
        case StorageType.NftStorage: {
          const client = nftStorageClient(walletKeypair, env, nftStorageKey);
          [link, imageLink, animationLink] = await nftStorageUpload(
            image,
            animation,
            manifestBuffer,
            client,
          );
          break;
        }
        case StorageType.Ipfs:
          [link, imageLink, animationLink] = await ipfsUpload(
            ipfsCredentials,
            image,
            animation,
            manifestBuffer,
          );
          break;
        case StorageType.Aws:
          [link, imageLink, animationLink] = await awsUpload(
            awsS3Bucket,
            image,
            animation,
            manifestBuffer,
          );
          break;
        case StorageType.Arweave:
        default:
          [link, imageLink] = await arweaveUpload(
            walletKeypair,
            anchorProgram,
            env,
            image,
            manifestBuffer,
            manifest,
            asset.index,
          );
      }
      if (animation ? link && imageLink && animationLink : link && imageLink) {
        log.info('Upload complete:', { link, imageLink, animationLink });
      }
    } catch (err: any) {
      log.error('Error uploading:', err.toString());
    }
  });

programCommand('upload-media-to-storage')
  .requiredOption('-f, --file <string>', 'media file')
  .requiredOption('-s, --storage <string>', 'storage type')
  .option('-r, --rpc-url <string>', 'Optional: Custom RPC url')
  .option('--nft-storage-key <string>', 'Optional: NFT storage key')
  .option('--ipfs-credentials <string>', 'Optional: IPFS credentials')
  .option('--pinata-jwt <string>', 'Optional: Pinata JWT')
  .option('--pinata-gateway <string>', 'Optional: Pinata Gateway')
  .option('--aws-s3-bucket <string>', 'Optional: AWS S3 Bucket')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const { keypair, env, file, storage, nftStorageKey } = cmd.opts();
    const walletKeypair = loadWalletKey(keypair);

    let link;
    try {
      switch (storage) {
        case StorageType.NftStorage: {
          const client = nftStorageClient(walletKeypair, env, nftStorageKey);
          link = await nftStorageUploadMedia(client, file);
          break;
        }
        default:
          throw new Error('Not implemented');
      }
      if (link) {
        log.info('Upload complete:', { link });
      }
    } catch (err: any) {
      log.error('Error uploading:', err.toString());
    }
  });

programCommand('upload-metadata-to-storage')
  .requiredOption('-f, --file <string>', 'metadata json file')
  .requiredOption('-s, --storage <string>', 'storage type')
  .option('-r, --rpc-url <string>', 'Optional: Custom RPC url')
  .option('--nft-storage-key <string>', 'Optional: NFT storage key')
  .option('--ipfs-credentials <string>', 'Optional: IPFS credentials')
  .option('--pinata-jwt <string>', 'Optional: Pinata JWT')
  .option('--pinata-gateway <string>', 'Optional: Pinata Gateway')
  .option('--aws-s3-bucket <string>', 'Optional: AWS S3 Bucket')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .action(async (directory, cmd) => {
    const { keypair, env, file, storage, nftStorageKey } = cmd.opts();
    const walletKeypair = loadWalletKey(keypair);

    const { dir: dirname, name: index } = path.parse(file);
    const asset = { index };
    const manifest = getAssetManifest(
      dirname,
      asset.index.includes('json') ? asset.index : `${asset.index}.json`,
    );

    const { image, animation_url } = manifest;
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const validUrl = url => {
      try {
        new URL(url);
        return true;
      } catch (err) {
        log.error('Invalid url:', err.message);
        return false;
      }
    };

    if (!image || !validUrl(image)) {
      throw new Error(`Invalid image specified in ${asset.index}.json`);
    }
    if (animation_url && !validUrl(animation_url)) {
      throw new Error(`Invalid animation_url specified in ${asset.index}.json`);
    }

    let link, imageLink, animationLink;
    try {
      switch (storage) {
        case StorageType.NftStorage: {
          const client = nftStorageClient(walletKeypair, env, nftStorageKey);
          const manifestJson = nftStorageManifestJson(manifestBuffer);
          [link, imageLink, animationLink] = await nftStorageUploadMetadata(
            client,
            manifestJson,
          );
          break;
        }
        default:
          throw new Error('Not implemented');
      }
      if (link) {
        log.info('Upload complete:', { link, imageLink, animationLink });
      }
    } catch (err: any) {
      log.error('Error uploading:', err.toString());
    }
  });

function programCommand(name: string) {
  return program
    .command(name)
    .option(
      '-e, --env <string>',
      'Solana cluster env name',
      'devnet', //mainnet-beta, testnet, devnet
    )
    .requiredOption('-k, --keypair <path>', 'Solana wallet location')
    .option('-l, --log-level <string>', 'log level', setLogLevel);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function setLogLevel(value, prev) {
  if (value === undefined || value === null) {
    return;
  }
  log.info('setting the log value to: ' + value);
  log.setLevel(value);
}

program.parse(process.argv);
