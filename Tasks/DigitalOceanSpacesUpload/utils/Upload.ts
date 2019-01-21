import { S3 } from 'aws-sdk'
import * as fs from 'fs'
import { isEmpty } from 'lodash'
import * as path from 'path'
import * as tl from 'vsts-task-lib'
import { Spaces } from '../common/Spaces'
import { Parameters } from './Parameters'
import { findFiles } from './utils'
import prettyBytes = require('pretty-bytes')

export class Upload extends Spaces<Parameters> {
  // known mime types as recognized by the AWS SDK for .NET and
  // AWS Toolkit for Visual Studio
  // Source: https://github.com/aws/aws-vsts-tools/blob/develop/Tasks/S3Upload/helpers/UploadTaskOperations.ts
  private static knownMimeTypes: Map<string, string> = new Map<string, string>([
    ['.ai', 'application/postscript'],
    ['.aif', 'audio/x-aiff'],
    ['.aifc', 'audio/x-aiff'],
    ['.aiff', 'audio/x-aiff'],
    ['.asc', 'text/plain'],
    ['.au', 'audio/basic'],
    ['.avi', 'video/x-msvideo'],
    ['.bcpio', 'application/x-bcpio'],
    ['.bin', 'application/octet-stream'],
    ['.c', 'text/plain'],
    ['.cc', 'text/plain'],
    ['.ccad', 'application/clariscad'],
    ['.cdf', 'application/x-netcdf'],
    ['.class', 'application/octet-stream'],
    ['.cpio', 'application/x-cpio'],
    ['.cpp', 'text/plain'],
    ['.cpt', 'application/mac-compactpro'],
    ['.cs', 'text/plain'],
    ['.csh', 'application/x-csh'],
    ['.css', 'text/css'],
    ['.dcr', 'application/x-director'],
    ['.dir', 'application/x-director'],
    ['.dms', 'application/octet-stream'],
    ['.doc', 'application/msword'],
    [
      '.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    ['.dot', 'application/msword'],
    ['.drw', 'application/drafting'],
    ['.dvi', 'application/x-dvi'],
    ['.dwg', 'application/acad'],
    ['.dxf', 'application/dxf'],
    ['.dxr', 'application/x-director'],
    ['.eps', 'application/postscript'],
    ['.etx', 'text/x-setext'],
    ['.exe', 'application/octet-stream'],
    ['.ez', 'application/andrew-inset'],
    ['.f', 'text/plain'],
    ['.f90', 'text/plain'],
    ['.fli', 'video/x-fli'],
    ['.gif', 'image/gif'],
    ['.gtar', 'application/x-gtar'],
    ['.gz', 'application/x-gzip'],
    ['.h', 'text/plain'],
    ['.hdf', 'application/x-hdf'],
    ['.hh', 'text/plain'],
    ['.hqx', 'application/mac-binhex40'],
    ['.htm', 'text/html'],
    ['.html', 'text/html'],
    ['.ice', 'x-conference/x-cooltalk'],
    ['.ief', 'image/ief'],
    ['.iges', 'model/iges'],
    ['.igs', 'model/iges'],
    ['.ips', 'application/x-ipscript'],
    ['.ipx', 'application/x-ipix'],
    ['.jpe', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.jpg', 'image/jpeg'],
    ['.js', 'application/x-javascript'],
    ['.kar', 'audio/midi'],
    ['.latex', 'application/x-latex'],
    ['.lha', 'application/octet-stream'],
    ['.lsp', 'application/x-lisp'],
    ['.lzh', 'application/octet-stream'],
    ['.m', 'text/plain'],
    ['.m3u8', 'application/x-mpegURL'],
    ['.man', 'application/x-troff-man'],
    ['.me', 'application/x-troff-me'],
    ['.mesh', 'model/mesh'],
    ['.mid', 'audio/midi'],
    ['.midi', 'audio/midi'],
    ['.mime', 'www/mime'],
    ['.mov', 'video/quicktime'],
    ['.movie', 'video/x-sgi-movie'],
    ['.mp2', 'audio/mpeg'],
    ['.mp3', 'audio/mpeg'],
    ['.mpe', 'video/mpeg'],
    ['.mpeg', 'video/mpeg'],
    ['.mpg', 'video/mpeg'],
    ['.mpga', 'audio/mpeg'],
    ['.ms', 'application/x-troff-ms'],
    ['.msi', 'application/x-ole-storage'],
    ['.msh', 'model/mesh'],
    ['.nc', 'application/x-netcdf'],
    ['.oda', 'application/oda'],
    ['.pbm', 'image/x-portable-bitmap'],
    ['.pdb', 'chemical/x-pdb'],
    ['.pdf', 'application/pdf'],
    ['.pgm', 'image/x-portable-graymap'],
    ['.pgn', 'application/x-chess-pgn'],
    ['.png', 'image/png'],
    ['.pnm', 'image/x-portable-anymap'],
    ['.pot', 'application/mspowerpoint'],
    ['.ppm', 'image/x-portable-pixmap'],
    ['.pps', 'application/mspowerpoint'],
    ['.ppt', 'application/mspowerpoint'],
    [
      '.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    ['.ppz', 'application/mspowerpoint'],
    ['.pre', 'application/x-freelance'],
    ['.prt', 'application/pro_eng'],
    ['.ps', 'application/postscript'],
    ['.qt', 'video/quicktime'],
    ['.ra', 'audio/x-realaudio'],
    ['.ram', 'audio/x-pn-realaudio'],
    ['.ras', 'image/cmu-raster'],
    ['.rgb', 'image/x-rgb'],
    ['.rm', 'audio/x-pn-realaudio'],
    ['.roff', 'application/x-troff'],
    ['.rpm', 'audio/x-pn-realaudio-plugin'],
    ['.rtf', 'text/rtf'],
    ['.rtx', 'text/richtext'],
    ['.scm', 'application/x-lotusscreencam'],
    ['.set', 'application/set'],
    ['.sgm', 'text/sgml'],
    ['.sgml', 'text/sgml'],
    ['.sh', 'application/x-sh'],
    ['.shar', 'application/x-shar'],
    ['.silo', 'model/mesh'],
    ['.sit', 'application/x-stuffit'],
    ['.skd', 'application/x-koan'],
    ['.skm', 'application/x-koan'],
    ['.skp', 'application/x-koan'],
    ['.skt', 'application/x-koan'],
    ['.smi', 'application/smil'],
    ['.smil', 'application/smil'],
    ['.snd', 'audio/basic'],
    ['.sol', 'application/solids'],
    ['.spl', 'application/x-futuresplash'],
    ['.src', 'application/x-wais-source'],
    ['.step', 'application/STEP'],
    ['.stl', 'application/SLA'],
    ['.stp', 'application/STEP'],
    ['.sv4cpio', 'application/x-sv4cpio'],
    ['.sv4crc', 'application/x-sv4crc'],
    ['.svg', 'image/svg+xml'],
    ['.swf', 'application/x-shockwave-flash'],
    ['.t', 'application/x-troff'],
    ['.tar', 'application/x-tar'],
    ['.tcl', 'application/x-tcl'],
    ['.tex', 'application/x-tex'],
    ['.tif', 'image/tiff'],
    ['.tiff', 'image/tiff'],
    ['.tr', 'application/x-troff'],
    ['.ts', 'video/MP2T'],
    ['.tsi', 'audio/TSP-audio'],
    ['.tsp', 'application/dsptype'],
    ['.tsv', 'text/tab-separated-values'],
    ['.txt', 'text/plain'],
    ['.unv', 'application/i-deas'],
    ['.ustar', 'application/x-ustar'],
    ['.vcd', 'application/x-cdlink'],
    ['.vda', 'application/vda'],
    ['.vrml', 'model/vrml'],
    ['.wav', 'audio/x-wav'],
    ['.wrl', 'model/vrml'],
    ['.xbm', 'image/x-xbitmap'],
    ['.xlc', 'application/vnd.ms-excel'],
    ['.xll', 'application/vnd.ms-excel'],
    ['.xlm', 'application/vnd.ms-excel'],
    ['.xls', 'application/vnd.ms-excel'],
    [
      '.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    ['.xlw', 'application/vnd.ms-excel'],
    ['.xml', 'text/xml'],
    ['.xpm', 'image/x-xpixmap'],
    ['.xwd', 'image/x-xwindowdump'],
    ['.xyz', 'chemical/x-pdb'],
    ['.zip', 'application/zip'],
    ['.m4v', 'video/x-m4v'],
    ['.webm', 'video/webm'],
    ['.ogv', 'video/ogv'],
    ['.xap', 'application/x-silverlight-app'],
    ['.mp4', 'video/mp4'],
    ['.wmv', 'video/x-ms-wmv'],
  ])

  constructor(params: Parameters) {
    super(params)
  }

  public async init(): Promise<void> {
    console.log(
      tl.loc(
        'UploadingFiles',
        this.params.digitalSourceFolder,
        this.params.digitalTargetFolder
          ? this.params.digitalTargetFolder
          : 'root',
        this.params.digitalBucket
      )
    )

    const files: string[] = findFiles(this.params)

    if (isEmpty(files)) {
      console.log(tl.loc('FileNotFound', this.params.digitalSourceFolder))
      return
    }

    for (const file of files) {
      const targetPath = this.normalizeKeyPath(file)

      try {
        let contentType: string
        if (this.params.digitalContentType) {
          contentType = this.params.digitalContentType
        } else {
          contentType = Upload.knownMimeTypes.get(path.extname(file))
          if (!contentType) {
            contentType = 'application/octet-stream'
          }
        }

        console.log(tl.loc('UploadingFile', file, targetPath, contentType))

        const params: S3.PutObjectRequest = {
          Bucket: this.params.digitalBucket,
          ACL: this.params.digitalAcl,
          Key: targetPath,
          Body: fs.createReadStream(file),
          ContentType: contentType,
        }

        const request: S3.ManagedUpload = this.s3Connection.upload(params)

        request.on('httpUploadProgress', progress => {
          console.log(
            tl.loc(
              'FileUploadProgress',
              prettyBytes(progress.loaded),
              prettyBytes(progress.total),
              Math.floor((progress.loaded / progress.total) * 100).toFixed(1)
            )
          )
        })

        const response: S3.ManagedUpload.SendData = await request.promise()
        console.log(tl.loc('FileUploadCompleted', file, targetPath))
      } catch (err) {
        console.error(tl.loc('FileUploadFailed'), err)
        throw err
      }
    }

    console.log(tl.loc('TaskCompleted'))
  }

  private normalizeKeyPath(file: string): string {
    let relativePath = file.substring(this.params.digitalSourceFolder.length)

    if (relativePath.startsWith(path.sep)) {
      relativePath = relativePath.substr(1)
    }

    let targetPath = relativePath

    if (this.params.digitalFlattenFolders) {
      const flatFileName = path.basename(file)
      targetPath = this.params.digitalTargetFolder
        ? path.join(this.params.digitalTargetFolder, flatFileName)
        : flatFileName
    } else {
      targetPath = this.params.digitalTargetFolder
        ? path.join(this.params.digitalTargetFolder, relativePath)
        : relativePath
    }

    return targetPath.replace(/\\/g, '/')
  }
}
