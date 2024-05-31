import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Reverter } from "../helpers/reverter";
import {
  CREATE_PERMISSION,
  DELETE_PERMISSION,
  EXECUTE_PERMISSION,
  REVIEWABLE_REQUESTS_RESOURCE,
  RequestStatus,
} from "../utils/constants";
import {
  IRBAC,
  MasterAccessManagement,
  MasterContractsRegistry,
  RequestExecutorMock,
  ReviewableRequests,
} from "@/generated-types";
import { ethers } from "hardhat";
import { expect } from "chai";
import { ZERO_ADDR } from "@/scripts/utils/constants";

describe("ReviewableRequests", () => {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;
  let USER1: SignerWithAddress;
  let USER2: SignerWithAddress;

  const ReviewableRequestsRole = "RR";

  const ReviewableRequestsCreate: IRBAC.ResourceWithPermissionsStruct = {
    resource: REVIEWABLE_REQUESTS_RESOURCE,
    permissions: [CREATE_PERMISSION],
  };
  const ReviewableRequestsExecute: IRBAC.ResourceWithPermissionsStruct = {
    resource: REVIEWABLE_REQUESTS_RESOURCE,
    permissions: [EXECUTE_PERMISSION],
  };
  const ReviewableRequestsDelete: IRBAC.ResourceWithPermissionsStruct = {
    resource: REVIEWABLE_REQUESTS_RESOURCE,
    permissions: [DELETE_PERMISSION],
  };

  let reviewableRequests: ReviewableRequests;
  let masterAccess: MasterAccessManagement;
  let registry: MasterContractsRegistry;

  before("setup", async () => {
    [OWNER, USER1, USER2] = await ethers.getSigners();
    const MasterContractsRegistry = await ethers.getContractFactory("MasterContractsRegistry");
    registry = await MasterContractsRegistry.deploy();

    const MasterAccessManagementFactory = await ethers.getContractFactory("MasterAccessManagement");
    masterAccess = await MasterAccessManagementFactory.deploy();
    const ReviewableRequests = await ethers.getContractFactory("ReviewableRequests");
    reviewableRequests = await ReviewableRequests.deploy();

    await registry.__MasterContractsRegistry_init(masterAccess);

    masterAccess = MasterAccessManagementFactory.attach(
      await registry.getMasterAccessManagement(),
    ) as MasterAccessManagement;
    await masterAccess.__MasterAccessManagement_init(OWNER);

    await registry.addProxyContract(await registry.REVIEWABLE_REQUESTS_NAME(), reviewableRequests);

    reviewableRequests = ReviewableRequests.attach(await registry.getReviewableRequests()) as ReviewableRequests;

    await registry.injectDependencies(await registry.REVIEWABLE_REQUESTS_NAME());

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("basic access", () => {
    it("should not set dependencies from non dependant", async () => {
      await expect(reviewableRequests.setDependencies(OWNER, "0x")).to.be.rejectedWith("Dependant: not an injector");
    });
  });

  describe("createRequest", () => {
    it("should create a reviewable request", async () => {
      await masterAccess.addPermissionsToRole(ReviewableRequestsRole, [ReviewableRequestsCreate], true);
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      await expect(reviewableRequests.connect(USER1).createRequest(OWNER, "0x00", "0x11", "Misc", "Simple request"))
        .to.emit(reviewableRequests, "RequestCreated")
        .withArgs("0", USER1, OWNER, "0x00", "0x11", "Misc", "Simple request");

      const request = await reviewableRequests.requests(0);

      expect(request.status).to.be.equal(RequestStatus.PENDING);
      expect(request.creator).to.be.equal(USER1);
      expect(request.executor).to.be.equal(OWNER);
      expect(request.acceptData).to.be.equal("0x00");
      expect(request.rejectData).to.be.equal("0x11");
      expect(request.misc).to.be.equal("Misc");

      expect(await reviewableRequests.nextRequestId()).to.be.equal("1");
    });

    it("should not create reviewable request with zero address executor", async () => {
      await masterAccess.addPermissionsToRole(ReviewableRequestsRole, [ReviewableRequestsCreate], true);
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      await expect(
        reviewableRequests.connect(USER1).createRequest(ZERO_ADDR, "0x00", "0x11", "Misc", "Simple request"),
      ).to.be.rejectedWith("ReviewableRequests: zero executor");
    });

    it("should not create reviewable request without permissions", async () => {
      await expect(
        reviewableRequests.connect(USER1).createRequest(OWNER, "0x00", "0x11", "Misc", "Simple request"),
      ).to.be.rejectedWith("ReviewableRequests: access denied");
    });
  });

  describe("dropRequest", () => {
    it("should drop the reviewable request", async () => {
      await masterAccess.addPermissionsToRole(
        ReviewableRequestsRole,
        [ReviewableRequestsCreate, ReviewableRequestsDelete],
        true,
      );
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      await reviewableRequests.connect(USER1).createRequest(OWNER, "0x", "0x", "Misc", "Simple request");

      const receipt = await (await reviewableRequests.connect(USER1).dropRequest(0)).wait();
      if (!receipt) return;
      expect((await reviewableRequests.requests(0)).status).to.be.equal(RequestStatus.DROPPED);

    expect(receipt.logs[0].fragment.name).to.be.equal("RequestDropped");
    expect(receipt.logs[0].args.requestId).to.be.equal("0");
    });

    it("should not drop the reviewable request twice", async () => {
      await masterAccess.addPermissionsToRole(
        ReviewableRequestsRole,
        [ReviewableRequestsCreate, ReviewableRequestsDelete],
        true,
      );
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      await reviewableRequests.connect(USER1).createRequest(OWNER, "0x", "0x", "Misc", "Simple request");

      await reviewableRequests.connect(USER1).dropRequest(0);
      await expect(reviewableRequests.connect(USER1).dropRequest(0)).to.be.rejectedWith(
        "ReviewableRequests: invalid request status",
      );
    });

    it("only creator should be able to drop the request", async () => {
      await masterAccess.addPermissionsToRole(
        ReviewableRequestsRole,
        [ReviewableRequestsCreate, ReviewableRequestsDelete],
        true,
      );
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);
      await masterAccess.grantRoles(USER2, [ReviewableRequestsRole]);

      await reviewableRequests.connect(USER1).createRequest(OWNER, "0x00", "0x11", "Misc", "Simple request");

      await expect(reviewableRequests.connect(USER2).dropRequest(0)).to.be.rejectedWith(
        "ReviewableRequests: not a request creator",
      );
    });

    it("should not drop reviewable request without permission", async () => {
      await expect(reviewableRequests.connect(USER1).dropRequest(0)).to.be.rejectedWith(
        "ReviewableRequests: access denied",
      );
    });
  });

  describe("updateRequest", () => {
    it("should update a reviewable request (1)", async () => {
      await masterAccess.addPermissionsToRole(
        ReviewableRequestsRole,
        [ReviewableRequestsCreate, ReviewableRequestsDelete],
        true,
      );
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      await reviewableRequests.connect(USER1).createRequest(OWNER, "0x00", "0x11", "Misc", "Simple request");
      const receipt = await (
        await reviewableRequests.connect(USER1).updateRequest(0, OWNER, "0x1111", "0x2222", "Misc2", "Updated request")
      ).wait();
      if (!receipt) return;
      expect(receipt.logs[0].fragment.name).to.be.equal("RequestUpdated");
      expect(receipt.logs[0].args.requestId).to.be.equal("0");
      expect(receipt.logs[0].args.newRequestId).to.be.equal("1");
      expect(receipt.logs[0].args.executor).to.be.equal(OWNER);
      expect(receipt.logs[0].args.acceptData).to.be.equal("0x1111");
      expect(receipt.logs[0].args.rejectData).to.be.equal("0x2222");
      expect(receipt.logs[0].args.misc).to.be.equal("Misc2");
      expect(receipt.logs[0].args.description).to.be.equal("Updated request");

      const request = await reviewableRequests.requests(0);
      const newRequest = await reviewableRequests.requests(1);

      expect(request.status).to.be.equal(RequestStatus.DROPPED);

      expect(newRequest.status).to.be.equal(RequestStatus.PENDING);
      expect(newRequest.creator).to.be.equal(USER1);
      expect(newRequest.executor).to.be.equal(OWNER);
      expect(newRequest.acceptData).to.be.equal("0x1111");
      expect(newRequest.rejectData).to.be.equal("0x2222");
      expect(newRequest.misc).to.be.equal("Misc2");

      expect(await reviewableRequests.nextRequestId()).to.be.equal("2");
    });

    it("should update a reviewable request (2)", async () => {
      await masterAccess.addPermissionsToRole(
        ReviewableRequestsRole,
        [ReviewableRequestsCreate, ReviewableRequestsDelete],
        true,
      );
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      await reviewableRequests.connect(USER1).createRequest(OWNER, "0x00", "0x11", "Misc", "Simple request");
      const receipt = await (
        await reviewableRequests.connect(USER1).updateRequest(0, USER2, "0x", "0x", "Misc2", "Updated request")
      ).wait();
      if (!receipt) return;
      expect(receipt.logs[0].fragment.name).to.be.equal("RequestUpdated");
      expect(receipt.logs[0].args.requestId).to.be.equal("0");
      expect(receipt.logs[0].args.newRequestId).to.be.equal("1");
      expect(receipt.logs[0].args.executor).to.be.equal(USER2);
      expect(receipt.logs[0].args.acceptData).to.be.equal("0x");
      expect(receipt.logs[0].args.rejectData).to.be.equal("0x");
      expect(receipt.logs[0].args.misc).to.be.equal("Misc2");
      expect(receipt.logs[0].args.description).to.be.equal("Updated request");

      const request = await reviewableRequests.requests(0);
      const newRequest = await reviewableRequests.requests(1);

      expect(request.status).to.be.equal(RequestStatus.DROPPED);

      expect(newRequest.status).to.be.equal(RequestStatus.PENDING);
      expect(newRequest.creator).to.be.equal(USER1);
      expect(newRequest.executor).to.be.equal(USER2);
      expect(newRequest.acceptData).to.be.equal("0x");
      expect(newRequest.rejectData).to.be.equal("0x");
      expect(newRequest.misc).to.be.equal("Misc2");

      expect(await reviewableRequests.nextRequestId()).to.be.equal("2");
    });

    it("should not update nonexisting request", async () => {
      await masterAccess.addPermissionsToRole(
        ReviewableRequestsRole,
        [ReviewableRequestsCreate, ReviewableRequestsDelete],
        true,
      );
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      await expect(
        reviewableRequests.connect(USER1).updateRequest(123, OWNER, "0x00", "0x11", "Misc", "Simple request"),
      ).to.be.rejectedWith("ReviewableRequests: invalid request status");
    });

    it("only creator should be able to update the request", async () => {
      await masterAccess.addPermissionsToRole(
        ReviewableRequestsRole,
        [ReviewableRequestsCreate, ReviewableRequestsDelete],
        true,
      );
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);
      await masterAccess.grantRoles(USER2, [ReviewableRequestsRole]);

      await reviewableRequests.connect(USER1).createRequest(OWNER, "0x00", "0x11", "Misc", "Simple request");

      await expect(
        reviewableRequests.connect(USER2).updateRequest(0, ZERO_ADDR, "0x", "0x", "Misc2", "Left request untouched"),
      ).to.be.rejectedWith("ReviewableRequests: not a request creator");
    });

    it("should not update reviewable request without permissions", async () => {
      await masterAccess.addPermissionsToRole(ReviewableRequestsRole, [ReviewableRequestsCreate], true);

      await expect(
        reviewableRequests.connect(USER1).updateRequest(0, OWNER, "0x00", "0x11", "Misc", "Simple request"),
      ).to.be.rejectedWith("ReviewableRequests: access denied");

      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      await expect(
        reviewableRequests.connect(USER1).updateRequest(0, OWNER, "0x00", "0x11", "Misc", "Simple request"),
      ).to.be.rejectedWith("ReviewableRequests: access denied");
    });
  });

  describe("acceptRequest", () => {
    let executor: RequestExecutorMock;

    beforeEach("setup", async () => {
      const RequestExecutorMock = await ethers.getContractFactory("RequestExecutorMock");
      executor = await RequestExecutorMock.deploy();
    });

    it("should accept the reviewable request", async () => {
      await masterAccess.addPermissionsToRole(
        ReviewableRequestsRole,
        [ReviewableRequestsCreate, ReviewableRequestsExecute],
        true,
      );
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      await reviewableRequests
        .connect(USER1)
        .createRequest(executor, (await executor.requestAccept()).data, "0x", "Misc", "Simple request");

      const receipt = await (await reviewableRequests.connect(USER1).acceptRequest(0)).wait();

      expect((await reviewableRequests.requests(0)).status).to.be.equal(RequestStatus.ACCEPTED);
      expect(await executor.status()).to.be.equal("1");
      if (!receipt) return;
      expect(receipt.logs[0].fragment.name).to.be.equal("RequestAccepted");
      expect(receipt.logs[0].args.requestId).to.be.equal("0");
    });

    it("should revert the reviewable request", async () => {
      await masterAccess.addPermissionsToRole(
        ReviewableRequestsRole,
        [ReviewableRequestsCreate, ReviewableRequestsExecute],
        true,
      );
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);
      const RequestExecutorMock = await ethers.getContractFactory("RequestExecutorMock");

      await reviewableRequests
        .connect(USER1)
        .createRequest(
          executor,
          RequestExecutorMock.interface.encodeFunctionData("requestRevert"),
          "0x",
          "Misc",
          "Simple request",
        );

      await expect(reviewableRequests.connect(USER1).acceptRequest(0)).to.be.rejectedWith(
        "ReviewableRequests: failed to accept request",
      );
    });

    it("should accept the request with empty data", async () => {
      await masterAccess.addPermissionsToRole(
        ReviewableRequestsRole,
        [ReviewableRequestsCreate, ReviewableRequestsExecute],
        true,
      );
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      await reviewableRequests.connect(USER1).createRequest(executor, "0x", "0x11", "Misc", "Simple request");

      await expect(reviewableRequests.connect(USER1).acceptRequest(0), "pass").to.be.fulfilled;
    });

    it("should not accept the request twice", async () => {
      await masterAccess.addPermissionsToRole(
        ReviewableRequestsRole,
        [ReviewableRequestsCreate, ReviewableRequestsExecute],
        true,
      );
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      await reviewableRequests
        .connect(USER1)
        .createRequest(executor, (await executor.requestAccept()).data, "0x", "Misc", "Simple request");

      await reviewableRequests.connect(USER1).acceptRequest(0);
      await expect(reviewableRequests.connect(USER1).acceptRequest(0)).to.be.rejectedWith(
        "ReviewableRequests: invalid request status",
      );
    });

    it("should not accept reviewable request without permission", async () => {
      await expect(reviewableRequests.connect(USER1).acceptRequest(0)).to.be.rejectedWith(
        "ReviewableRequests: access denied",
      );
    });
  });

  describe("rejectRequest", () => {
    let executor: RequestExecutorMock;

    beforeEach("setup", async () => {
      const RequestExecutorMock = await ethers.getContractFactory("RequestExecutorMock");
      executor = await RequestExecutorMock.deploy();
    });
    it("should reject the reviewable request", async () => {
      await masterAccess.addPermissionsToRole(
        ReviewableRequestsRole,
        [ReviewableRequestsCreate, ReviewableRequestsExecute],
        true,
      );
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      await reviewableRequests
        .connect(USER1)
        .createRequest(executor, "0x", (await executor.requestReject()).data, "Misc", "Simple request");

      const receipt = await (await reviewableRequests.connect(USER1).rejectRequest(0, "rejected")).wait();

      expect((await reviewableRequests.requests(0)).status).to.be.equal(RequestStatus.REJECTED);
      expect(await executor.status()).to.be.equal("2");
      if (!receipt) return;
      expect(receipt.logs[0].fragment.name).to.be.equal("RequestRejected");
      expect(receipt.logs[0].args.requestId).to.be.equal("0");
      expect(receipt.logs[0].args.reason).to.be.equal("rejected");
    });

    it("should revert the reviewable request", async () => {
      await masterAccess.addPermissionsToRole(
        ReviewableRequestsRole,
        [ReviewableRequestsCreate, ReviewableRequestsExecute],
        true,
      );
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);
      const RequestExecutorMock = await ethers.getContractFactory("RequestExecutorMock");

      await reviewableRequests
        .connect(USER1)
        .createRequest(
          executor,
          "0x",
          RequestExecutorMock.interface.encodeFunctionData("requestRevert"),
          "Misc",
          "Simple request",
        );

      await expect(reviewableRequests.connect(USER1).rejectRequest(0, "rejected")).to.be.rejectedWith(
        "ReviewableRequests: failed to reject request",
      );
    });

    it("should reject the request with empty data", async () => {
      await masterAccess.addPermissionsToRole(
        ReviewableRequestsRole,
        [ReviewableRequestsCreate, ReviewableRequestsExecute],
        true,
      );
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      await reviewableRequests.connect(USER1).createRequest(executor, "0x11", "0x", "Misc", "Simple request");

      await expect(reviewableRequests.connect(USER1).rejectRequest(0, "rejected"), "pass").to.be.fulfilled;
    });

    it("should not reject the request twice", async () => {
      await masterAccess.addPermissionsToRole(
        ReviewableRequestsRole,
        [ReviewableRequestsCreate, ReviewableRequestsExecute],
        true,
      );
      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      await reviewableRequests
        .connect(USER1)
        .createRequest(
          executor,
          (await executor.requestAccept()).data,
          (await executor.requestReject()).data,
          "Misc",
          "Simple request",
        );

      await reviewableRequests.connect(USER1).acceptRequest(0);
      await expect(reviewableRequests.connect(USER1).rejectRequest(0, "rejected")).to.be.rejectedWith(
        "ReviewableRequests: invalid request status",
      );
    });

    it("should not accept reviewable request without permission", async () => {
      await expect(reviewableRequests.connect(USER1).rejectRequest(0, "rejected")).to.be.rejectedWith(
        "ReviewableRequests: access denied",
      );
    });
  });
});
