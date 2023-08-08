import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateMyPcDto } from './dto/create-my-pc.dto';
import { UpdateMyPcDto } from './dto/update-my-pc.dto';
import { Model, Types } from 'mongoose';
import { User } from 'src/auth/entities/user.entity';
import { InjectModel } from '@nestjs/mongoose';
import { MyPc } from './entities/my-pc.entity';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileNamer } from './helper/fileNamer.helper';
import { saveImgDisk } from './helper/saveImgDisk.helper';

@Injectable()
export class MyPcService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(MyPc.name)
    private readonly myPcModel: Model<MyPc>,
  ) {}

  async submitMyPc(
    createMyPcDto: CreateMyPcDto,
    user:any
  ) {
    //TODO: Almacenar la imagen en disco
    const fileNameUuid = fileNamer(createMyPcDto.file.extension);
    saveImgDisk(createMyPcDto.file,fileNameUuid);

    // Esta parte se encarga de almacenar la información del dto en la db
    try {
      const id = new Types.ObjectId(user._id);
     const userEntity = {
        ...createMyPcDto,
        user: id,
        image: fileNameUuid,
      };
      await this.myPcModel.create(userEntity);
    } catch (error) {
      console.log(error);
      this.handleDbException(error);
    }
   
  }

  async getAll(user, session, offset = 1) {
    let isEnabledBtnPreviousPage = true;
    let isEnabledBtnNextPage = true;

    // validamos el offset
    offset = Number(offset);
    if (!isNaN(offset)) {
      if (offset <= 0) {
        offset = 1;
      }
      session.currentPage = offset;
      session.previousPage = session.currentPage - 1;
      session.nextPage = session.currentPage + 1;
    } else {
      offset = 1;
      session.currentPage = offset;
      session.previousPage = session.currentPage - 1;
      session.nextPage = session.currentPage + 1;
    }
    // Obtenemos las pc
    const pcs = await this.myPcModel
      .find({ user: new Types.ObjectId(user._id) })
      .lean()
      .limit(1)
      .skip(offset - 1);
    const nextPcs = await this.myPcModel
      .find({ user: new Types.ObjectId(user._id) })
      .lean()
      .limit(1)
      .skip(offset);

    // Validamos por si el usuario realiza paginado por url

    //Desactivamos los botones

    if (session.currentPage === 1) {
      isEnabledBtnPreviousPage = false;
    }

    if (nextPcs.length === 0) {
      isEnabledBtnNextPage = false;
    }

    // Agregamos la url de las fotos
    const pcsWithUrlImage = pcs.map((pc) => {
      // console.log(x)
      const { image,_id, ...restoPc } = pc;
      const urlImage = 'http://localhost:3000/myPc/see/' + image;
      const urlEditPc = 'http://localhost:3000/myPc/edit/'+_id;
      // console.log(nuevaImagen)
      return {
        ...restoPc,
        urlImage,
        urlEditPc
      };
    });
    /*

        if (!session.currentPage || session.currentPage <= 1 || offset === 0) {

            session.currentPage = 1;
            session.nextPage = 2;
            session.previousPage = 1;
        } else {
            session.currentPage = offset;

            session.nextPage = offset + 1;
            session.previousPage = offset - 1;
        }

*/

    return {
      pcsWithUrlImage,
      isEnabled: {
        isEnabledBtnPreviousPage,
        isEnabledBtnNextPage,
      },
      pagination: {
        currentPage: session.currentPage,
        nextPage: session.nextPage,
        previousPage: session.previousPage,
      },
    };
  }

  private handleDbException(error: any) {
    if (error.code === 11000) {
      throw new BadRequestException('Ya existe ');
    } else {
      throw new InternalServerErrorException(
        `Cant create  - Check server logs`,
      );
    }
  }

  getStaticProductImage(imageName: string) {
    const path = join(__dirname, '../../uploads/', imageName);
    if (!existsSync(path)) {
      throw new BadRequestException('No se encontró la imagen: ' + imageName);
    }

    return path;
  }
  async findMyPc(id:string,user){
    try {
    const pc =  await this.myPcModel.findById(id);
    if (pc.user.toString()!=user._id) {
      throw new BadRequestException('La computadora no le pertenece');
      
    }

    return pc;
    } catch (error) {
      console.log(error)
    }

  }
  async updateMyPc(id:string,user,updateMyPcDto:UpdateMyPcDto){
    
   const pc = await this.findMyPc(id,user);

   if (pc) {
    await this.myPcModel.findByIdAndUpdate(pc.id,updateMyPcDto);
   }

  }
}
