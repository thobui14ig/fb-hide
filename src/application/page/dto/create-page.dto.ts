import { IsArray, IsString } from "class-validator";

export class CreatePageDto {
    @IsArray({ message: "Danh sách truyền lên phải là 1 mảng" })
    @IsString({ each: true, message: "Page phải là string" })
    pages: string[]
}
